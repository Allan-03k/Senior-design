import base64
import os
from typing import List, Dict, Any

import anthropic
import requests

VISION_API_KEY = os.getenv("VISION_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

_anthropic_client = None


def _get_anthropic_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _anthropic_client

# Normalize API label variants to canonical ingredient names
LABEL_MAP = {
    # Peppers
    "bell pepper": "bell pepper",
    "capsicum": "bell pepper",
    "red pepper": "bell pepper",
    "green pepper": "bell pepper",
    "yellow pepper": "bell pepper",
    "sweet pepper": "bell pepper",
    "chili pepper": "chili",
    "chilli": "chili",
    "chile pepper": "chili",
    "hot pepper": "chili",
    "jalapeño": "jalapeno",
    # Onion family
    "scallion": "green onion",
    "spring onion": "green onion",
    "red onion": "onion",
    "white onion": "onion",
    "yellow onion": "onion",
    "purple onion": "onion",
    "shallot": "shallot",
    # Cheese
    "cheddar": "cheese",
    "mozzarella": "cheese",
    "parmesan": "cheese",
    "feta": "cheese",
    "brie": "cheese",
    "gouda": "cheese",
    "ricotta": "cheese",
    "cottage cheese": "cheese",
    "cream cheese": "cheese",
    # Dairy
    "dairy product": "milk",
    "cow milk": "milk",
    "skim milk": "milk",
    "whole milk": "milk",
    "heavy cream": "cream",
    "whipping cream": "cream",
    "sour cream": "cream",
    # Eggs
    "egg yolk": "egg",
    "egg white": "egg",
    "boiled egg": "egg",
    "fried egg": "egg",
    "scrambled egg": "egg",
    "poached egg": "egg",
    # Tomatoes
    "bush tomato": "tomato",
    "plum tomato": "tomato",
    "cherry tomato": "tomato",
    "grape tomato": "tomato",
    "roma tomato": "tomato",
    "sun-dried tomato": "tomato",
    # Lettuce/Greens
    "leaf vegetable": "lettuce",
    "salad greens": "lettuce",
    "romaine": "lettuce",
    "iceberg": "lettuce",
    "mixed greens": "lettuce",
    "baby spinach": "spinach",
    # Potatoes
    "sweet potato": "sweet potato",
    "yam": "sweet potato",
    "russet potato": "potato",
    "red potato": "potato",
    "fingerling potato": "potato",
    "new potato": "potato",
    # Squash
    "butternut squash": "squash",
    "acorn squash": "squash",
    "spaghetti squash": "squash",
    "yellow squash": "squash",
    # Mushrooms
    "shiitake": "mushroom",
    "portobello": "mushroom",
    "button mushroom": "mushroom",
    "cremini": "mushroom",
    "oyster mushroom": "mushroom",
    "enoki": "mushroom",
    # Proteins
    "ground beef": "beef",
    "ground pork": "pork",
    "pork belly": "pork",
    "pork chop": "pork",
    "chicken breast": "chicken",
    "chicken thigh": "chicken",
    "chicken wing": "chicken",
    "roast chicken": "chicken",
    "salmon fillet": "salmon",
    "fish fillet": "fish",
    "smoked salmon": "salmon",
    # Grains / Noodles
    "white rice": "rice",
    "brown rice": "rice",
    "fried rice": "rice",
    "ramen noodle": "noodle",
    "udon noodle": "noodle",
    "rice noodle": "noodle",
    "soba noodle": "noodle",
    "pasta noodle": "pasta",
    # Beans / Legumes
    "black bean": "black bean",
    "kidney bean": "kidney bean",
    "chickpea": "chickpea",
    "garbanzo": "chickpea",
    "lentil": "lentil",
    "soybean": "soybean",
    "edamame": "edamame",
    "green pea": "pea",
    "snow pea": "snow pea",
    # Nuts
    "peanut butter": "peanut",
    "almond butter": "almond",
    "walnut halve": "walnut",
    # Herbs & Spices
    "fresh basil": "basil",
    "fresh parsley": "parsley",
    "fresh cilantro": "cilantro",
    "fresh mint": "mint",
    "fresh ginger": "ginger",
    "ground ginger": "ginger",
    "ground cinnamon": "cinnamon",
    "ground cumin": "cumin",
    "ground turmeric": "turmeric",
    # Fruits
    "mandarin": "orange",
    "tangerine": "orange",
    "clementine": "orange",
    "navel orange": "orange",
    "fuji apple": "apple",
    "granny smith": "apple",
    "red apple": "apple",
    "green apple": "apple",
    "cavendish banana": "banana",
    "passion fruit": "passion fruit",
    "dragon fruit": "dragon fruit",
    "star fruit": "star fruit",
    # Condiments
    "soy sauce": "soy sauce",
    "fish sauce": "fish sauce",
    "oyster sauce": "oyster sauce",
    "hot sauce": "hot sauce",
    "olive oil": "olive oil",
    "sesame oil": "sesame oil",
    "vegetable oil": "oil",
    "coconut oil": "coconut oil",
    "apple cider vinegar": "vinegar",
    "balsamic vinegar": "vinegar",
    "rice vinegar": "vinegar",
}

# Comprehensive food whitelist — includes multi-word items
KNOWN_FOODS = {
    # Proteins – Meat
    "egg", "chicken", "beef", "pork", "lamb", "turkey", "duck", "goose",
    "veal", "venison", "rabbit", "bison", "bacon", "ham", "sausage",
    "salami", "pepperoni", "prosciutto", "chorizo", "spam", "hot dog",
    "ground beef", "ground pork", "chicken breast", "chicken thigh",
    "chicken wing", "pork belly", "pork chop", "pork loin", "beef steak",
    "beef brisket", "beef ribs", "lamb chop", "rack of lamb",
    # Proteins – Seafood
    "fish", "salmon", "tuna", "shrimp", "crab", "lobster", "squid",
    "oyster", "clam", "mussel", "scallop", "anchovy", "sardine", "cod",
    "tilapia", "halibut", "trout", "mackerel", "herring", "sea bass",
    "snapper", "mahi mahi", "catfish", "swordfish", "eel",
    # Proteins – Plant
    "tofu", "tempeh", "seitan", "edamame",
    # Vegetables – Single word
    "tomato", "onion", "garlic", "carrot", "broccoli", "spinach", "lettuce",
    "cabbage", "cucumber", "corn", "mushroom", "pepper", "celery",
    "asparagus", "eggplant", "zucchini", "kale", "leek", "artichoke",
    "cauliflower", "radish", "turnip", "beet", "pea", "okra", "fennel",
    "watercress", "arugula", "chive", "parsley", "cilantro", "basil",
    "thyme", "rosemary", "sage", "mint", "dill", "oregano", "ginger",
    "jalapeno", "potato", "yam", "kohlrabi", "endive", "radicchio",
    "tomatillo", "jicama", "daikon", "cassava", "plantain", "shallot",
    "chili", "squash", "pumpkin", "avocado",
    # Vegetables – Multi-word
    "sweet potato", "bell pepper", "green onion", "bok choy", "green bean",
    "snow pea", "baby spinach", "cherry tomato", "spring onion",
    "purple cabbage", "red cabbage", "brussels sprout", "snap pea",
    "sugar snap", "butternut squash", "acorn squash", "kabocha squash",
    "napa cabbage", "water chestnut", "bamboo shoot", "lotus root",
    "bitter melon", "winter melon", "choy sum", "gai lan",
    # Fruits – Single word
    "apple", "banana", "orange", "lemon", "lime", "pineapple", "strawberry",
    "blueberry", "grape", "mango", "papaya", "peach", "pear", "plum",
    "cherry", "watermelon", "melon", "kiwi", "coconut", "fig", "pomegranate",
    "raspberry", "blackberry", "cranberry", "apricot", "nectarine",
    "grapefruit", "tangerine", "persimmon", "lychee", "longan", "guava",
    "jackfruit", "durian", "rambutan", "starfruit",
    # Fruits – Multi-word
    "passion fruit", "dragon fruit", "star fruit", "mandarin orange",
    "blood orange", "honeydew melon", "cantaloupe melon",
    # Dairy & Eggs
    "milk", "cheese", "butter", "cream", "yogurt", "kefir",
    "cream cheese", "sour cream", "cottage cheese", "heavy cream",
    "condensed milk", "evaporated milk", "buttermilk", "ghee",
    # Grains, Pasta & Bread
    "rice", "pasta", "bread", "noodle", "flour", "oats", "quinoa",
    "barley", "tortilla", "couscous", "rye", "wheat", "bagel",
    "croissant", "dumpling", "wonton", "spaghetti", "fettuccine",
    "penne", "linguine", "lasagna", "gnocchi", "polenta", "grits",
    "white rice", "brown rice", "jasmine rice", "basmati rice",
    "rice noodle", "ramen noodle", "udon noodle", "soba noodle",
    # Legumes
    "bean", "lentil", "chickpea", "soybean", "kidney bean", "black bean",
    "pinto bean", "navy bean", "cannellini bean", "fava bean", "mung bean",
    "adzuki bean",
    # Nuts & Seeds
    "almond", "walnut", "cashew", "peanut", "pistachio", "pecan",
    "hazelnut", "sesame", "sunflower seed", "pumpkin seed", "flaxseed",
    "chia seed", "hemp seed", "pine nut", "macadamia",
    # Condiments & Oils
    "oil", "vinegar", "soy sauce", "fish sauce", "oyster sauce",
    "hot sauce", "ketchup", "mustard", "mayonnaise", "honey", "sugar",
    "salt", "miso", "tahini", "hummus", "pesto", "salsa", "guacamole",
    "olive oil", "sesame oil", "coconut oil",
    # Spices & Herbs (dried)
    "cinnamon", "cumin", "turmeric", "paprika", "cardamom", "coriander",
    "nutmeg", "clove", "allspice", "anise", "bay leaf", "vanilla",
    # Beverages used in cooking
    "wine", "beer", "sake", "mirin", "stock", "broth",
    "chicken broth", "beef broth", "vegetable broth",
    # Sweeteners & Baking
    "chocolate", "cocoa", "maple syrup", "molasses", "corn syrup",
    "baking powder", "baking soda", "yeast",
}

# Single words that strongly suggest a food item (used in fallback)
FOOD_HINT_WORDS = {
    "berry", "melon", "bean", "pea", "nut", "seed", "leaf", "root",
    "herb", "spice", "squash", "gourd", "sprout", "shoot", "bulb",
    "pepper", "sauce", "oil", "cream", "cheese", "bread", "cake",
    "noodle", "rice", "meat", "fish", "egg", "milk", "fruit", "veggie",
}

MIN_LABEL_SCORE = 0.10
MIN_OBJECT_SCORE = 0.10


def _normalize_name(name: str) -> str | None:
    name = (name or "").strip().lower()
    if not name:
        return None
    return LABEL_MAP.get(name, name)


def _is_food(name: str) -> bool:
    """Return True if name is in the known foods whitelist or contains a food hint word."""
    if name in KNOWN_FOODS:
        return True
    tokens = name.split()
    if any(t in FOOD_HINT_WORDS for t in tokens):
        return True
    return False


def _extract_candidates(data: Dict[str, Any]) -> List[str]:
    response = (data.get("responses") or [{}])[0]

    label_annotations = response.get("labelAnnotations", [])
    object_annotations = response.get("localizedObjectAnnotations", [])

    candidates: List[str] = []

    for label in label_annotations:
        score = float(label.get("score", 0.0))
        if score < MIN_LABEL_SCORE:
            continue
        name = _normalize_name(label.get("description", ""))
        if not name:
            continue
        if _is_food(name):
            candidates.append(name)

    for obj in object_annotations:
        score = float(obj.get("score", 0.0))
        if score < MIN_OBJECT_SCORE:
            continue
        name = _normalize_name(obj.get("name", ""))
        if not name:
            continue
        if _is_food(name):
            candidates.append(name)

    # Deduplicate while preserving order
    seen = set()
    result = []
    for item in candidates:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _claude_fallback(image_bytes: bytes) -> List[str]:
    """Use Claude Haiku to identify ingredients when Google Vision returns nothing useful."""
    client = _get_anthropic_client()
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": base64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "List only the food ingredients visible in this image. "
                            "If the image is too blurry or unclear to identify any ingredients, "
                            "reply with exactly: UNCLEAR_IMAGE\n"
                            "Otherwise reply with a comma-separated list of ingredient names only, "
                            "no explanations. Example: tomato, onion, garlic"
                        ),
                    },
                ],
            }
        ],
    )

    text = message.content[0].text.strip()
    if text == "UNCLEAR_IMAGE":
        return []

    return [item.strip().lower() for item in text.split(",") if item.strip()]


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
                    {"type": "LABEL_DETECTION", "maxResults": 20},
                    {"type": "OBJECT_LOCALIZATION", "maxResults": 20},
                ],
            }
        ]
    }

    response = requests.post(url, json=payload, timeout=20)
    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise RuntimeError(data["error"].get("message", "Google Vision API error"))

    ingredients = _extract_candidates(data)

    if not ingredients and ANTHROPIC_API_KEY:
        ingredients = _claude_fallback(image_bytes)

    return ingredients


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
                    {"type": "LABEL_DETECTION", "maxResults": 20},
                    {"type": "OBJECT_LOCALIZATION", "maxResults": 20},
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

    ingredients = _extract_candidates(data)
    used_fallback = False

    if not ingredients and ANTHROPIC_API_KEY:
        ingredients = _claude_fallback(image_bytes)
        used_fallback = True

    return {
        "raw_labels": [
            {"name": item.get("description", "").lower(), "score": item.get("score", 0.0)}
            for item in resp.get("labelAnnotations", [])
        ],
        "raw_objects": [
            {"name": item.get("name", "").lower(), "score": item.get("score", 0.0)}
            for item in resp.get("localizedObjectAnnotations", [])
        ],
        "ingredients": ingredients,
        "claude_fallback_used": used_fallback,
    }
