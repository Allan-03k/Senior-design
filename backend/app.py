import os
import logging
import time
import json
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pydantic import ValidationError
from dotenv import load_dotenv

from models import db, Recipe, RecipeIngredient
from services.recipes import recommend_recipes, get_shopping_missing
from services.places import search_restaurants
from services.vision import recognize_from_file, recognize_from_hint
from services.webrecipes import discover_recipes_from_web
from schemas.dto import (
    RecognizeResponse, RecommendRequest, RecommendResponse,
    ShoppingListRequest, ShoppingListResponse
)

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///smartcuisine.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

db.init_app(app)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

def ok(payload: dict, status=200): return jsonify(payload), status
def err(code="BAD_REQUEST", message="bad request", status=400): return jsonify({"error": {"code": code, "message": message}}), status

# Seed Data
def init_data():
    """If no data is found in the database, write some initial recipes."""
    if Recipe.query.first():
        return
    
    app.logger.info("Initializing database with seed data...")
    seeds = [
        {
            "name": "Tomato Egg Stir-Fry", "cuisine": "Chinese",
            "steps": "Beat eggs; stir-fry tomatoes; combine; season.",
            "ings": [("tomato", "2"), ("egg", "3"), ("salt", "to taste"), ("oil", "1 tbsp")]
        },
        {
            "name": "Caprese Salad", "cuisine": "Italian",
            "steps": "Slice tomatoes; add mozzarella & basil; drizzle olive oil.",
            "ings": [("tomato", "2"), ("mozzarella", "120g"), ("basil", "few leaves"), ("olive oil", "1 tbsp")]
        },
        {
            "name": "Cucumber Egg Roll", "cuisine": "Japanese",
            "steps": "Make thin omelet; add cucumber; roll and slice.",
            "ings": [("egg", "3"), ("cucumber", "1"), ("salt", "pinch")]
        }
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
def health(): return ok({"status": "ok", "db": "connected"})

@app.post("/api/ingredients/recognize")
def recognize():

    if "image" in request.files:
        f = request.files["image"]
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
    
    results = recommend_recipes(payload.ingredients)
    return ok(RecommendResponse(recipes=results).model_dump())

@app.post("/api/shopping-list")
def shopping_list():
    try:
        payload = ShoppingListRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return err(message=e.errors()[0]["msg"])
    
    missing = get_shopping_missing(payload.recipe_id, payload.ingredients)
    if missing is None:
        return err("NOT_FOUND", "recipe not found", 404)
        
    return ok(ShoppingListResponse(missing=missing).model_dump())

@app.post("/api/recipes/search-web")
def search_web():
    data = request.get_json(force=True) or {}
    ingredients = data.get("ingredients", [])
    cuisine = data.get("cuisine")
    if not ingredients:
        return err("BAD_REQUEST", "ingredients required")
    items = discover_recipes_from_web(ingredients, cuisine=cuisine, limit=5)
    return ok({"items": items})

@app.get("/api/restaurants/search")
def restaurants():
    cuisine = request.args.get("cuisine", "Italian")
    try:
        lat = float(request.args.get("lat", "41.76"))
        lng = float(request.args.get("lng", "-72.67"))
    except ValueError:
        return err(message="invalid lat/lng")
    
    # Call the real Places Service
    results = search_restaurants(cuisine, lat, lng)
    return ok({"cuisine": cuisine, "results": results})

@app.get("/openapi.json")
def openapi():
    with open("openapi.json", "r", encoding="utf-8") as f:
        return jsonify(json.load(f))

@app.get("/docs")
def docs():
    return Response("""
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
    """, mimetype="text/html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)), debug=True)