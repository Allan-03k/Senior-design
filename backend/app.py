import os, logging, time
from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import ValidationError
from schemas.dto import (
    RecognizeResponse, RecommendRequest, RecommendResponse, RecipeItem,
    ShoppingListRequest, ShoppingListResponse, ShoppingListItem
)
from services.vision import recognize_from_file, recognize_from_hint
from services.places import search_restaurants

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ALLOW_ORIGINS", "*")}})

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---- helpers ----
def ok(payload: dict, status=200):
    return jsonify(payload), status

def err(code="BAD_REQUEST", message="bad request", status=400):
    return jsonify({"error": {"code": code, "message": message}}), status

@app.before_request
def _start_timer():
    request._t0 = time.time()

@app.after_request
def _log_resp(resp):
    try:
        dt = (time.time() - getattr(request, "_t0", time.time())) * 1000
        logging.info("%s %s %s %.1fms", request.method, request.path, resp.status_code, dt)
    except Exception:
        pass
    return resp

# ---- routes ----
@app.get("/health")
def health():
    return ok({"status": "ok"})

@app.post("/api/ingredients/recognize")
def recognize():
    if "image" in request.files:
        data = recognize_from_file(request.files["image"])
    else:
        hint = ""
        if request.is_json:
            hint = (request.json or {}).get("mock_image_hint", "")
        data = recognize_from_hint(hint)
    return ok(RecognizeResponse(**data).model_dump())

@app.post("/api/recipes/recommend")
def recommend():
    try:
        payload = RecommendRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])
    # 简易规则匹配（真实版本请替换为数据库/算法）
    base = [
        {
            "id": 1, "name": "Tomato Egg Stir-Fry", "cuisine": "Chinese",
            "required_ingredients": ["tomato", "egg", "salt", "oil"],
            "steps": "Beat eggs; stir-fry tomatoes; combine; season."
        },
        {
            "id": 2, "name": "Caprese Salad", "cuisine": "Italian",
            "required_ingredients": ["tomato", "mozzarella", "basil", "olive oil"],
            "steps": "Slice tomatoes; add mozzarella & basil; drizzle olive oil; season."
        },
        {
            "id": 3, "name": "Cucumber Egg Roll", "cuisine": "Japanese",
            "required_ingredients": ["egg", "cucumber", "salt"],
            "steps": "Make thin omelet; add cucumber; roll and slice."
        },
    ]
    u = set(payload.ingredients)
    results = []
    for r in base:
        req = set(r["required_ingredients"])
        ratio = len(u & req) / len(req)
        if ratio >= 0.6:
            results.append(RecipeItem(
                id=r["id"], name=r["name"], cuisine=r["cuisine"],
                match_ratio=round(ratio, 2),
                required_ingredients=list(req),
                steps=r["steps"]
            ))
    return ok(RecommendResponse(recipes=results).model_dump())

@app.post("/api/shopping-list")
def shopping_list():
    try:
        payload = ShoppingListRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])
    # 假数据：根据 recipe_id 找所需食材
    recipe_map = {
        1: [("tomato","2"),("egg","3"),("salt","to taste"),("oil","1 tbsp")],
        2: [("tomato","2"),("mozzarella","120g"),("basil","few leaves"),("olive oil","1 tbsp")],
        3: [("egg","3"),("cucumber","1"),("salt","pinch")]
    }
    required = recipe_map.get(payload.recipe_id)
    if not required:
        return err("NOT_FOUND", "recipe not found", 404)
    owned = set([i.strip().lower() for i in payload.ingredients])
    missing = [ShoppingListItem(ingredient=i, qty=q) for i, q in required if i not in owned]
    return ok(ShoppingListResponse(missing=missing).model_dump())

@app.get("/api/restaurants/search")
def restaurants():
    cuisine = request.args.get("cuisine", "Italian")
    try:
        lat = float(request.args.get("lat", "41.76"))
        lng = float(request.args.get("lng", "-72.67"))
    except ValueError:
        return err(message="invalid lat/lng")
    results = search_restaurants(cuisine, lat, lng)
    return ok({"cuisine": cuisine, "results": results})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)), debug=True)
