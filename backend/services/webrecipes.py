# backend/services/webrecipes.py
import os
import re
import requests

GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CX  = os.getenv("GOOGLE_CSE_ID")

UA = {"User-Agent": "SmartCuisineBot/0.1 (+https://example.com/contact)"}

def search_recipe_items(query: str, count=5):
    """通过 Google Programmable Search (CSE) 搜索网页结果（不解析 HTML）"""
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
    """根据标题+摘要文本和用户食材的重合度打一个 0~1 的分数"""
    text_tokens = set(re.findall(r"[a-zA-Z]+", text.lower()))
    ing = set(i.lower() for i in ingredients)
    if not text_tokens:
        return 0.0
    overlap = len(text_tokens & ing)
    ratio = overlap / len(text_tokens)
    return round(ratio, 3)

def discover_recipes_from_web(ingredients: list[str], cuisine: str | None = None, limit=5):
    """
    根据 ingredients (+ 可选 cuisine) 调用 Google CSE，
    返回若干条简单的“网上菜谱候选”：
    - name: 标题
    - url:  链接
    - instructions: 用 snippet 作为简单描述
    - ingredients: 暂时空列表
    - score: 与食材的文本匹配度
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
