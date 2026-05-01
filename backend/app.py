import os
import logging
import time
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pydantic import ValidationError
from dotenv import load_dotenv
from requests import HTTPError

from models import db, Recipe, RecipeIngredient
from services.recipes import recommend_recipes, get_shopping_missing
from services.places import search_restaurants, geocode_address
from services.webrecipes import discover_recipes_from_web
from services.vision import debug_detect_all
from flask import request, jsonify

from schemas.dto import (
    RecognizeResponse, RecommendRequest, RecommendResponse,
    ShoppingListRequest, ShoppingListResponse
)

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
os.makedirs(app.instance_path, exist_ok=True)
os.makedirs('generated_videos', exist_ok=True)

from services.cooking_guide import cooking_guide_bp
app.register_blueprint(cooking_guide_bp)

db_path = os.path.join(app.instance_path, "smartcuisine.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

db.init_app(app)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def ok(payload: dict, status=200):
    return jsonify(payload), status


def err(code="BAD_REQUEST", message="bad request", status=400):
    return jsonify({"error": {"code": code, "message": message}}), status


# Seed Data
def init_data():
    """If no data is found in the database, insert some initial recipes."""
    if Recipe.query.first():
        return

    app.logger.info("Initializing database with seed data...")
    seeds = [
        {
            "name": "Tomato Egg Stir-Fry",
            "cuisine": "Chinese",
            "steps": "Beat eggs; stir-fry tomatoes; combine; season.",
            "ings": [("tomato", "2"), ("egg", "3"), ("salt", "to taste"), ("oil", "1 tbsp")],
        },
        {
            "name": "Caprese Salad",
            "cuisine": "Italian",
            "steps": "Slice tomatoes; add mozzarella & basil; drizzle olive oil.",
            "ings": [
                ("tomato", "2"),
                ("mozzarella", "120g"),
                ("basil", "few leaves"),
                ("olive oil", "1 tbsp"),
            ],
        },
        {
            "name": "Cucumber Egg Roll",
            "cuisine": "Japanese",
            "steps": "Make thin omelet; add cucumber; roll and slice.",
            "ings": [("egg", "3"), ("cucumber", "1"), ("salt", "pinch")],
        },
    ]

    for s in seeds:
        r = Recipe(name=s["name"], cuisine=s["cuisine"], steps=s["steps"])
        db.session.add(r)
        db.session.flush()
        for ing_name, qty in s["ings"]:
            db.session.add(RecipeIngredient(recipe_id=r.id, name=ing_name, qty=qty))

    db.session.commit()
    app.logger.info("Database seeded!")


with app.app_context():
    db.create_all()
    init_data()

# --- Routes ---


@app.get("/health")
def health():
    return ok({"status": "ok", "db": "connected"})

@app.post("/api/ingredients/recognize")
def recognize_ingredients():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    image_bytes = file.read()
    result = debug_detect_all(image_bytes)

    return jsonify(result)

@app.post("/api/ingredients/recognize")
def recognize():
    """
    Recognize ingredients from an uploaded image or from a mock hint string.
    """
    if "image" in request.files:
        f = request.files["image"]
        data = recognize_from_file(f)
    else:
        hint = (request.json or {}).get("mock_image_hint", "") if request.is_json else ""
        data = recognize_from_hint(hint)
    return ok(RecognizeResponse(**data).model_dump())


@app.post("/api/recipes/recommend")
def recommend():
    """
    Recommend local recipes based on pantry ingredients.
    """
    try:
        payload = RecommendRequest(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])

    results = recommend_recipes(payload.ingredients, threshold=payload.threshold)
    return ok(RecommendResponse(recipes=results).model_dump())


@app.post("/api/shopping-list")
def shopping_list():
    """
    Compute missing ingredients for a selected recipe given the user's pantry.
    """
    try:
        payload = ShoppingListRequest(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])

    missing = get_shopping_missing(payload.recipe_id, payload.ingredients)
    if missing is None:
        return err("NOT_FOUND", "recipe not found", 404)

    return ok(ShoppingListResponse(missing=missing).model_dump())


@app.post("/api/recipes/search-web")
def search_web():
    """
    Search recipes from the web using Google Custom Search.

    The heavy lifting (including SQLite caching and Google quota
    handling) is done inside discover_recipes_from_web().
    Here we only:
    - validate input
    - catch HTTPError so that 429 / quota issues will not crash the API
    """
    data = request.get_json(silent=True) or {}
    ingredients = data.get("ingredients", [])
    cuisine = data.get("cuisine")
    start = int(data.get("start", 1))

    if not ingredients:
        return err("BAD_REQUEST", "ingredients required")

    try:
        # Use a small limit here; discover_recipes_from_web will also
        # read/write from cache to save quota.
        items = discover_recipes_from_web(
            ingredients=ingredients,
            cuisine=cuisine,
            limit=10,
            start=start,
        )
    except HTTPError as e:
        app.logger.error("search_web HTTPError: %s", e)
        # When Google quota is exceeded we gracefully return an empty list
        items = []
    except Exception as e:
        app.logger.error("search_web failed: %s", e)
        items = []

    return ok({"items": items})


@app.get("/api/restaurants/search")
def restaurants():
    """
    Search nearby restaurants using Google Places API.
    Query: cuisine, lat, lng, radius (meters, 500–50000, default 2000).
    """
    cuisine = request.args.get("cuisine", "Italian")
    try:
        lat = float(request.args.get("lat", "41.76"))
        lng = float(request.args.get("lng", "-72.67"))
    except ValueError:
        return err(message="invalid lat/lng")

    try:
        radius = int(request.args.get("radius", "2000"))
    except ValueError:
        radius = 2000

    payload = search_restaurants(cuisine, lat, lng, radius=radius)
    return ok(
        {
            "cuisine": cuisine,
            "location": {"lat": lat, "lng": lng, "radius_m": radius},
            "results": payload.get("results", []),
            "places_status": payload.get("status"),
            "places_error_message": payload.get("error_message") or "",
        }
    )


@app.get("/api/geocode")
def geocode():
    """Resolve a street address or place name to coordinates (Geocoding API)."""
    address = (request.args.get("address") or "").strip()
    if not address:
        return err(message="address query parameter required")

    out = geocode_address(address)
    if not out:
        return err(
            "NOT_FOUND",
            "Could not resolve that address. Try a fuller query (e.g. Mansfield, CT, USA) or check your network.",
            404,
        )
    return ok(out)


@app.get("/openapi.json")
def openapi():
    spec_path = os.path.join(os.path.dirname(__file__), "openapi.json")
    with open(spec_path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.get("/docs")
def docs():
    """
    Simple Swagger UI host page.
    """
    return Response(
        """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
        <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '/openapi.json',
                dom_id: '#swagger-ui',
            });
        };
        </script>
    </body>
    </html>
    """,
        mimetype="text/html",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)), debug=True)
