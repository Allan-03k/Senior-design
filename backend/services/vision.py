import base64
import os
from typing import List, Dict, Any

import requests

VISION_API_KEY = os.getenv("VISION_API_KEY")

IGNORE_LABELS = {
    "food",
    "ingredient",
    "produce",
    "plant",
    "vegetable",
    "fruit",
    "natural foods",
    "food group",
    "kitchen appliance",
    "major appliance",
    "home appliance",
    "refrigerator",
    "bottle",
    "container",
    "appliance",
    "recipe",
    "dish",
    "cuisine",
    "meal",
    "tableware",
    "shelf",
    "kitchen",
    "supermarket",
    "packaged goods",
}

LABEL_MAP = {
    "bell pepper": "pepper",
    "capsicum": "pepper",
    "red pepper": "pepper",
    "green pepper": "pepper",
    "yellow pepper": "pepper",
    "scallion": "green onion",
    "spring onion": "green onion",
    "red onion": "onion",
    "white onion": "onion",
    "cheddar": "cheese",
    "mozzarella": "cheese",
    "dairy product": "milk",
    "cow milk": "milk",
    "egg yolk": "egg",
    "boiled egg": "egg",
    "fried egg": "egg",
    "leaf vegetable": "lettuce",
    "salad greens": "lettuce",
    "bush tomato": "tomato",
    "plum tomato": "tomato",
}


KNOWN_FOODS = {
    "tomato",
    "egg",
    "milk",
    "cheese",
    "onion",
    "green onion",
    "garlic",
    "potato",
    "carrot",
    "broccoli",
    "cabbage",
    "pepper",
    "apple",
    "banana",
    "orange",
    "pineapple",
    "mushroom",
    "lettuce",
    "cucumber",
    "spinach",
    "corn",
    "beef",
    "chicken",
    "pork",
    "fish",
    "shrimp",
    "rice",
    "pasta",
    "bread",
    "sausage",
    "ham",
    "strawberry",
    "blueberry",
    "grape",
    "lemon",
    "lime",
    "avocado",
}

MIN_LABEL_SCORE = 0.10
MIN_OBJECT_SCORE = 0.10


def _normalize_name(name: str) -> str | None:
    name = (name or "").strip().lower()
    if not name:
        return None

    if name in LABEL_MAP:
        return LABEL_MAP[name]

    return name


def _extract_candidates(data: Dict[str, Any]) -> List[str]:
    response = (data.get("responses") or [{}])[0]

    label_annotations = response.get("labelAnnotations", [])
    object_annotations = response.get("localizedObjectAnnotations", [])

    candidates: List[str] = []

    # 1) label detection
    for label in label_annotations:
        score = float(label.get("score", 0.0))
        if score < MIN_LABEL_SCORE:
            continue

        raw_name = label.get("description", "")
        name = _normalize_name(raw_name)

        if not name:
            continue

        if name in IGNORE_LABELS:
            continue

        if name in KNOWN_FOODS:
            candidates.append(name)
            continue

        if " " not in name:
            candidates.append(name)

    # 2) object localization
    for obj in object_annotations:
        score = float(obj.get("score", 0.0))
        if score < MIN_OBJECT_SCORE:
            continue

        raw_name = obj.get("name", "")
        name = _normalize_name(raw_name)

        if not name:
            continue

        if name in IGNORE_LABELS:
            continue

        if name in KNOWN_FOODS:
            candidates.append(name)
            continue

        if " " not in name:
            candidates.append(name)

    seen = set()
    result = []
    for item in candidates:
        if item not in seen:
            seen.add(item)
            result.append(item)

    return result


def detect_ingredients(image_bytes: bytes) -> List[str]:
    if not VISION_API_KEY:
        raise RuntimeError("VISION_API_KEY is not set in environment variables.")

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    url = f"https://vision.googleapis.com/v1/images:annotate?key={VISION_API_KEY}"

    payload = {
        "requests": [
            {
                "image": {"content": base64_image},
                "features": [
                    {"type": "LABEL_DETECTION", "maxResults": 10},
                    {"type": "OBJECT_LOCALIZATION", "maxResults": 10},
                ],
            }
        ]
    }

    response = requests.post(url, json=payload, timeout=20)
    response.raise_for_status()

    data = response.json()

    if "error" in data:
        raise RuntimeError(data["error"].get("message", "Google Vision API error"))

    return _extract_candidates(data)


def debug_detect_all(image_bytes: bytes) -> Dict[str, Any]:
    if not VISION_API_KEY:
        raise RuntimeError("VISION_API_KEY is not set in environment variables.")

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    url = f"https://vision.googleapis.com/v1/images:annotate?key={VISION_API_KEY}"

    payload = {
        "requests": [
            {
                "image": {"content": base64_image},
                "features": [
                    {"type": "LABEL_DETECTION", "maxResults": 10},
                    {"type": "OBJECT_LOCALIZATION", "maxResults": 10},
                ],
            }
        ]
    }

    response = requests.post(url, json=payload, timeout=20)
    response.raise_for_status()

    data = response.json()

    if "error" in data:
        raise RuntimeError(data["error"].get("message", "Google Vision API error"))

    resp = (data.get("responses") or [{}])[0]

    raw_labels = [
        {
            "name": item.get("description", "").lower(),
            "score": item.get("score", 0.0),
        }
        for item in resp.get("labelAnnotations", [])
    ]

    raw_objects = [
        {
            "name": item.get("name", "").lower(),
            "score": item.get("score", 0.0),
        }
        for item in resp.get("localizedObjectAnnotations", [])
    ]

    ingredients = _extract_candidates(data)

    return {
        "raw_labels": raw_labels,
        "raw_objects": raw_objects,
        "ingredients": ingredients,
    }