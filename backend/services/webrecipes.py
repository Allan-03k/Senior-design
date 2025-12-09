import os
import re
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import requests

from models import db, WebRecipeCache


GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CX = os.getenv("GOOGLE_CSE_ID")

# Simple user-agent string for Google requests
UA = {"User-Agent": "SmartCuisineBot/0.1 (+https://example.com/contact)"}

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
    """
    Low-level helper to call Google Custom Search JSON API.

    We keep `count` small (10) to reduce daily quota usage.
    """
    if not GOOGLE_KEY or not GOOGLE_CX:
        raise RuntimeError(
            "Google API key or CX not set (GOOGLE_API_KEY / GOOGLE_CSE_ID)"
        )

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_KEY,
        "cx": GOOGLE_CX,
        "q": f"{query} recipe",
        "num": count,
    }

    resp = requests.get(url, params=params, headers=UA, timeout=12)
    # This may raise HTTPError(429) when quota is exceeded
    resp.raise_for_status()

    data = resp.json()
    return data.get("items") or []


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
        # Simple word-boundary check
        if re.search(r"\b" + re.escape(ing) + r"\b", text):
            hits += 1

    return hits / len(ingredients)


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
        # Fresh cache hit
        try:
            cached_items = json.loads(existing.items_json)
            return cached_items[:limit]
        except Exception:
            # Corrupted cache, ignore and fall through to live call
            pass

    # --- 2) Build query string for Google ---
    query = " ".join(ingredients)
    if cuisine:
        query += f" {cuisine}"

    # --- 3) Call Google CSE (may raise HTTPError 429) ---
    try:
        raw_items = _google_search(query, count=limit)
    except requests.HTTPError as e:
        # If quota exceeded but we have some old cache, use it instead
        if existing:
            try:
                cached_items = json.loads(existing.items_json)
                return cached_items[:limit]
            except Exception:
                pass
        # Re-raise so the caller can log / handle gracefully
        raise e

    # --- 4) Transform raw items into simplified recipe dicts ---
    results: List[Dict[str, Any]] = []
    for it in raw_items:
        title = it.get("title", "Untitled Recipe")
        link = it.get("link")
        snippet = it.get("snippet", "")

        text = (title + " " + snippet).lower()
        score = score_by_text(text, ingredients)

        results.append(
            {
                "name": title,
                "url": link,
                "image": None,            # We are not parsing images here yet
                "ingredients": [],        # Could be parsed later if needed
                "instructions": [snippet] if snippet else [],
                "score": score,
            }
        )

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
