import os
import re
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

from models import db, WebRecipeCache


# Browser-like UA helps avoid bot/challenge fallback pages.
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}

# How long a cache entry is considered "fresh"
CACHE_TTL_DAYS = 3


def _make_cache_key(ingredients: List[str], cuisine: Optional[str]) -> str:
    """
    Build a stable cache key from ingredients + cuisine.
    Example: ["Egg", "tomato"] + "Italian" -> "egg,tomato|italian"
    """
    normalized = sorted(
        i.strip().lower()
        for i in ingredients
        if isinstance(i, str) and i.strip()
    )
    key = ",".join(normalized)
    if cuisine:
        key += "|" + cuisine.strip().lower()
    return key


def _google_search(query: str, count: int = 10) -> List[Dict[str, Any]]:
    google_key = os.getenv("GOOGLE_API_KEY")
    google_cx = os.getenv("GOOGLE_CSE_ID")

    if not google_key or not google_cx:
        raise RuntimeError("Google API key or CX not set (GOOGLE_API_KEY / GOOGLE_CSE_ID)")

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": google_key,
        "cx": google_cx,
        "q": f"{query} recipe",
        "num": count,
    }

    resp = requests.get(url, params=params, headers=UA, timeout=12)
    resp.raise_for_status()
    return resp.json().get("items") or []


def extract_image_url(it: Dict[str, Any]) -> Optional[str]:
    pagemap = it.get("pagemap") or {}

    cse_image = pagemap.get("cse_image") or []
    if cse_image and isinstance(cse_image, list):
        src = (cse_image[0] or {}).get("src")
        if src:
            return src

    cse_thumb = pagemap.get("cse_thumbnail") or []
    if cse_thumb and isinstance(cse_thumb, list):
        src = (cse_thumb[0] or {}).get("src")
        if src:
            return src

    metatags = pagemap.get("metatags") or []
    if metatags and isinstance(metatags, list):
        m0 = metatags[0] or {}
        og = m0.get("og:image") or m0.get("twitter:image")
        if og:
            return og

    return None


def score_by_text(text: str, ingredients: List[str]) -> float:
    """
    Assign a score from 0.0 to 1.0 based on how many ingredients
    appear in the given text.
    Very naive but good enough for a demo.
    """
    if not ingredients:
        return 0.0

    text = text.lower()
    hits = 0
    for ing in ingredients:
        ing = ing.strip().lower()
        if not ing:
            continue
        if re.search(r"\b" + re.escape(ing) + r"\b", text):
            hits += 1

    return hits / len(ingredients)


def _clean_ingredient_text(text: str) -> str:
    """
    Normalize ingredient line text a little for display/shopping-list use.
    """
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("\xa0", " ").strip()
    return text


def _looks_like_ingredient(text: str) -> bool:
    """
    Very simple heuristic for whether a line looks like an ingredient.
    We intentionally keep this broad for demo purposes.
    """
    if not text:
        return False

    text = text.strip().lower()
    if len(text) < 2 or len(text) > 120:
        return False

    blacklist = [
        "instructions",
        "directions",
        "method",
        "step ",
        "minutes",
        "nutrition",
        "calories",
        "review",
        "rating",
        "share",
        "comment",
        "advertisement",
    ]
    if any(word in text for word in blacklist):
        return False

    # Looks like an ingredient if it contains common quantity/unit patterns
    quantity_or_unit_patterns = [
        r"\b\d+([\/.]\d+)?\b",      # 1, 2, 1/2, 1.5
        r"\bcup\b", r"\bcups\b",
        r"\btsp\b", r"\btbsp\b",
        r"\bteaspoon\b", r"\bteaspoons\b",
        r"\btablespoon\b", r"\btablespoons\b",
        r"\boz\b", r"\bounces?\b",
        r"\blb\b", r"\bpound\b", r"\bpounds\b",
        r"\bg\b", r"\bkg\b",
        r"\bml\b", r"\bl\b",
        r"\bclove\b", r"\bcloves\b",
        r"\bslice\b", r"\bslices\b",
        r"\bcan\b", r"\bcans\b",
        r"\bpackage\b", r"\bpackages\b",
        r"\bpinch\b",
    ]

    if any(re.search(pat, text) for pat in quantity_or_unit_patterns):
        return True

    # Also allow short list-like food lines
    short_food_words = [
        "egg", "milk", "cheese", "butter", "oil", "salt", "pepper",
        "onion", "garlic", "tomato", "rice", "chicken", "beef", "pork",
        "fish", "shrimp", "broccoli", "cabbage", "carrot", "mushroom",
        "lettuce", "cucumber", "spinach", "corn", "potato", "pasta",
    ]
    if any(word in text for word in short_food_words):
        return True

    return False


def _extract_recipe_nodes_from_jsonld(data: Any) -> List[Dict[str, Any]]:
    """
    Traverse arbitrary JSON-LD payload and collect all Recipe nodes.
    Handles common wrappers such as @graph / mainEntity / itemListElement.
    """
    found: List[Dict[str, Any]] = []
    queue = deque([data])

    while queue:
        node = queue.popleft()
        if isinstance(node, list):
            queue.extend(node)
            continue
        if not isinstance(node, dict):
            continue

        node_type = node.get("@type")
        is_recipe = False
        if isinstance(node_type, list):
            is_recipe = "Recipe" in node_type
        elif isinstance(node_type, str):
            is_recipe = node_type == "Recipe"
        if is_recipe:
            found.append(node)

        for key in ("@graph", "mainEntity", "itemListElement", "hasPart"):
            child = node.get(key)
            if child is not None:
                queue.append(child)

    return found


def _looks_like_blocked_page(soup: BeautifulSoup) -> bool:
    """
    Detect obvious anti-bot / consent / challenge pages.
    """
    body_text = soup.get_text(" ", strip=True).lower()
    title_text = (soup.title.get_text(" ", strip=True).lower() if soup.title else "")
    hay = f"{title_text} {body_text[:3000]}"
    blocked_signals = [
        "captcha",
        "verify you are human",
        "access denied",
        "enable javascript",
        "before you continue",
        "consent",
        "cloudflare",
        "challenge",
    ]
    return any(sig in hay for sig in blocked_signals)


def fetch_ingredients_from_page(url: str) -> List[str]:
    """
    Fetch a recipe page and try to extract ingredients.

    This is a generic parser, so it will not be perfect on every site,
    but it is much better than always returning [].
    """
    try:
        resp = requests.get(url, headers=UA, timeout=12, allow_redirects=True)
        resp.raise_for_status()
    except Exception:
        return []

    try:
        # Be explicit about decoding to reduce mojibake on badly-declared pages.
        if not resp.encoding:
            resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.content, "html.parser", from_encoding=resp.encoding)
        if _looks_like_blocked_page(soup):
            return []
        ingredients: List[str] = []

        # --- Strategy 1: schema.org Recipe JSON-LD ---
        for script in soup.find_all("script", type="application/ld+json"):
            raw = script.string or script.get_text(strip=True)
            if not raw:
                continue

            try:
                data = json.loads(raw)
            except Exception:
                continue

            for node in _extract_recipe_nodes_from_jsonld(data):
                recipe_ingredients = node.get("recipeIngredient") or node.get("ingredients") or []
                if isinstance(recipe_ingredients, list):
                    for item in recipe_ingredients:
                        if isinstance(item, str):
                            cleaned = _clean_ingredient_text(item)
                            if cleaned and cleaned not in ingredients:
                                ingredients.append(cleaned)
                elif isinstance(recipe_ingredients, str):
                    cleaned = _clean_ingredient_text(recipe_ingredients)
                    if cleaned and cleaned not in ingredients:
                        ingredients.append(cleaned)

        if ingredients:
            return ingredients[:25]

        # --- Strategy 2: common ingredient selectors on recipe sites ---
        selectors = [
            '[itemprop="recipeIngredient"]',
            ".ingredient",
            ".ingredients-item",
            ".ingredients-item-name",
            ".recipe-ingredients li",
            ".ingredients li",
            "ul.ingredients li",
            "ol.ingredients li",
        ]

        for selector in selectors:
            for node in soup.select(selector):
                text = _clean_ingredient_text(node.get_text(" ", strip=True))
                if _looks_like_ingredient(text) and text not in ingredients:
                    ingredients.append(text)

        if ingredients:
            return ingredients[:25]

        # --- Strategy 3: constrained fallback ---
        # Restrict to containers likely related to ingredient blocks.
        fallback_selectors = [
            '[class*="ingredient"] li',
            '[id*="ingredient"] li',
            '[class*="recipe"] [class*="ingredient"] li',
            "section.ingredients li",
            "div.ingredients li",
        ]
        for selector in fallback_selectors:
            for li in soup.select(selector):
                text = _clean_ingredient_text(li.get_text(" ", strip=True))
                if _looks_like_ingredient(text) and text not in ingredients:
                    ingredients.append(text)

        return ingredients[:25]

    except Exception:
        return []


def discover_recipes_from_web(
    ingredients: List[str],
    cuisine: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    High-level function used by the Flask API.

    1. Build a cache key from ingredients + cuisine
    2. If we have a fresh cache entry in SQLite, return it directly
    3. Otherwise call Google CSE, transform the results, save to cache
    4. If Google fails (429 / quota exceeded) but we have an old cache,
       return the old cache instead of crashing.
    """
    cache_key = _make_cache_key(ingredients, cuisine)
    now = datetime.utcnow()
    cutoff = now - timedelta(days=CACHE_TTL_DAYS)

    # --- 1) Try cache first ---
    existing: Optional[WebRecipeCache] = (
        WebRecipeCache.query
        .filter_by(key=cache_key)
        .order_by(WebRecipeCache.created_at.desc())
        .first()
    )

    if existing and existing.created_at >= cutoff:
        try:
            cached_items = json.loads(existing.items_json)
            return cached_items[:limit]
        except Exception:
            pass

    # --- 2) Build query string for Google ---
    # Preserve user input order while deduplicating.
    normalized_ings = list(
        dict.fromkeys(
            i.strip().lower()
            for i in ingredients
            if isinstance(i, str) and i.strip()
        )
    )

    query = " ".join(normalized_ings)
    if cuisine:
        query += f" {cuisine.strip().lower()}"

    # --- 3) Call Google CSE ---
    try:
        raw_items = _google_search(query, count=limit)
    except requests.HTTPError as e:
        if existing:
            try:
                cached_items = json.loads(existing.items_json)
                return cached_items[:limit]
            except Exception:
                pass
        raise e

    # --- 4) Transform raw items into recipe dicts ---
    results: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    for it in raw_items:
        link = it.get("link")
        if not link:
            continue
        title = it.get("title") or "Untitled Recipe"
        snippet = it.get("snippet") or ""
        text = (title + " " + snippet).lower()
        candidates.append(
            {
                "name": title,
                "url": link,
                "image": extract_image_url(it),
                "instructions": [snippet] if snippet else [],
                "score": score_by_text(text, normalized_ings),
            }
        )

    # Fetch ingredients concurrently to reduce total latency.
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {
            executor.submit(fetch_ingredients_from_page, item["url"]): item
            for item in candidates
        }
        for future in as_completed(future_map):
            item = future_map[future]
            try:
                item["ingredients"] = future.result() or []
            except Exception:
                item["ingredients"] = []
            results.append(item)

    # Sort by match score, highest first
    results.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    results = results[:limit]

    # --- 5) Save / update cache in SQLite (best-effort) ---
    try:
        payload = json.dumps(results, ensure_ascii=False)
        if existing:
            existing.items_json = payload
            existing.created_at = now
        else:
            cache_row = WebRecipeCache(
                key=cache_key,
                items_json=payload,
                created_at=now,
            )
            db.session.add(cache_row)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return results