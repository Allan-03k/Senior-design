# backend/services/webrecipes.py
import os
import re
import requests

GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CX  = os.getenv("GOOGLE_CSE_ID")

UA = {"User-Agent": "SmartCuisineBot/0.1 (+https://example.com/contact)"}

def search_recipe_items(query: str, count=5):
    """Searching web pages using Google Programmable Search (CSE) (without parsing HTML)"""
    if not GOOGLE_KEY or not GOOGLE_CX:
        raise RuntimeError("Google API key or CX not set (GOOGLE_API_KEY / GOOGLE_CSE_ID)")

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": GOOGLE_KEY,
        "cx": GOOGLE_CX,
        "q": f"{query} recipe",
        "num": count,
    }
    r = requests.get(url, params=params, headers=UA, timeout=12)
    r.raise_for_status()
    return r.json().get("items", []) or []

def score_by_text(text: str, ingredients: list[str]) -> float:
    """Assign a score from 0 to 1 based on the degree of overlap between the title/summary text and the user's ingredients."""
    text_tokens = set(re.findall(r"[a-zA-Z]+", text.lower()))
    ing = set(i.lower() for i in ingredients)
    if not text_tokens:
        return 0.0
    overlap = len(text_tokens & ing)
    ratio = overlap / len(text_tokens)
    return round(ratio, 3)

def discover_recipes_from_web(ingredients: list[str], cuisine: str | None = None, limit=5):
    """
    Calling Google CSE based on ingredients (+ optional cuisine),
    returns several simple "online recipe candidates":
    - name: title
    - url: link
    - instructions: a short description using a snippet
    - ingredients: a temporarily empty list
    - score: text matching score of the ingredients
    """
    query = " ".join(ingredients)
    if cuisine:
        query += f" {cuisine}"

    items = search_recipe_items(query, count=limit)
    results = []

    for it in items:
        title = it.get("title", "Untitled Recipe")
        link = it.get("link")
        snippet = it.get("snippet", "")
        text = (title + " " + snippet).lower()
        score = score_by_text(text, ingredients)
        results.append({
            "name": title,
            "url": link,
            "image": None,
            "ingredients": [],         
            "instructions": [snippet] if snippet else [],
            "score": score,
        })

    results.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    return results[:limit]
