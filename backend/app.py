import os
import logging
import time
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pydantic import ValidationError
from dotenv import load_dotenv  # 新增：加载 .env

from schemas.dto import (
    RecognizeResponse, RecommendRequest, RecommendResponse, RecipeItem,
    ShoppingListRequest, ShoppingListResponse, ShoppingListItem
)
from services.vision import recognize_from_file, recognize_from_hint
from services.places import search_restaurants
from services.webrecipes import discover_recipes_from_web  # 新增

# 载入 .env（若存在）
load_dotenv()

app = Flask(__name__)

# CORS（开发期可 * ，上线请收紧）
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ALLOW_ORIGINS", "*")}})

# 上传限制：最大 5MB
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
ALLOWED_EXT = {"jpg", "jpeg", "png"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

def ok(payload: dict, status=200): return jsonify(payload), status
def err(code="BAD_REQUEST", message="bad request", status=400): return jsonify({"error": {"code": code, "message": message}}), status
def _allowed(filename: str) -> bool: return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

@app.before_request
def _start_timer(): request._t0 = time.time()

@app.after_request
def _log_resp(resp):
    try:
        dt = (time.time() - getattr(request, "_t0", time.time())) * 1000
        app.logger.info("%s %s %s %.1fms", request.method, request.path, resp.status_code, dt)
    except Exception:
        pass
    return resp

@app.errorhandler(404)
def not_found(_): return err("NOT_FOUND", f"{request.path} not found", 404)

@app.errorhandler(413)
def too_large(_): return err("PAYLOAD_TOO_LARGE", "file too large (max 5MB)", 413)

@app.errorhandler(500)
def server_err(e):
    app.logger.exception(e)
    return err("SERVER_ERROR", "internal error", 500)

@app.get("/")
def index():
    return ok({
        "service": "SmartCuisine API",
        "endpoints": [
            "/health",
            "/api/ingredients/recognize",
            "/api/recipes/recommend",
            "/api/recipes/search-web",
            "/api/shopping-list",
            "/api/restaurants/search",
            "/openapi.json",
            "/docs"
        ]
    })

@app.get("/health")
def health(): return ok({"status": "ok"})

@app.post("/api/ingredients/recognize")
def recognize():
    """
    支持两种调用：
    - multipart/form-data: files['image'] 传图片（仅限 jpg/png）
    - application/json:   {"mock_image_hint": "..."} 供早期调试
    """
    if "image" in request.files:
        f = request.files["image"]
        if not f.filename: return err("BAD_REQUEST", "empty filename")
        if not _allowed(f.filename): return err("UNSUPPORTED_MEDIA_TYPE", "only jpg/png allowed", 415)
        data = recognize_from_file(f)
    else:
        hint = (request.json or {}).get("mock_image_hint", "") if request.is_json else ""
        data = recognize_from_hint(hint)
    return ok(RecognizeResponse(**data).model_dump())

@app.post("/api/recipes/recommend")
def recommend():
    try:
        payload = RecommendRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])
    base = [
        {"id": 1, "name": "Tomato Egg Stir-Fry", "cuisine": "Chinese",
         "required_ingredients": ["tomato", "egg", "salt", "oil"],
         "steps": "Beat eggs; stir-fry tomatoes; combine; season."},
        {"id": 2, "name": "Caprese Salad", "cuisine": "Italian",
         "required_ingredients": ["tomato", "mozzarella", "basil", "olive oil"],
         "steps": "Slice tomatoes; add mozzarella & basil; drizzle olive oil; season."},
        {"id": 3, "name": "Cucumber Egg Roll", "cuisine": "Japanese",
         "required_ingredients": ["egg", "cucumber", "salt"],
         "steps": "Make thin omelet; add cucumber; roll and slice."},
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

# 新增：网上搜菜谱（Google CSE + 结构化解析）
@app.post("/api/recipes/search-web")
def search_web():
    data = request.get_json(force=True) or {}
    ingredients = data.get("ingredients", [])
    cuisine = data.get("cuisine")
    if not ingredients:
        return err("BAD_REQUEST", "ingredients required")
    items = discover_recipes_from_web(ingredients, cuisine=cuisine, limit=5)
    return ok({"items": items})

@app.post("/api/shopping-list")
def shopping_list():
    try:
        payload = ShoppingListRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])
    recipe_map = {
        1: [("tomato", "2"), ("egg", "3"), ("salt", "to taste"), ("oil", "1 tbsp")],
        2: [("tomato", "2"), ("mozzarella", "120g"), ("basil", "few leaves"), ("olive oil", "1 tbsp")],
        3: [("egg", "3"), ("cucumber", "1"), ("salt", "pinch")]
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

# ---- OpenAPI & Docs ----
@app.get("/openapi.json")
def openapi_spec():
    try:
        here = os.path.dirname(__file__)
        with open(os.path.join(here, "openapi.json"), "r", encoding="utf-8") as f:
            return Response(f.read(), mimetype="application/json")
    except FileNotFoundError:
        return err("NOT_FOUND", "openapi.json not found", 404)

@app.get("/docs")
def docs():
    html = """
    <!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>SmartCuisine API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
    <style>body{margin:0} #swagger-ui{max-width:1200px;margin:0 auto}</style>
    </head><body><div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>window.ui=SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui'});</script>
    </body></html>"""
    return html

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)), debug=True)
