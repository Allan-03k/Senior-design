from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""
    pass


# Global SQLAlchemy instance used across the app
db = SQLAlchemy(model_class=Base)


class Recipe(db.Model):
    """
    Local recipe stored in SQLite.

    This is used for fast, offline recommendations based on a small
    curated set of recipes.
    """
    __tablename__ = "recipes"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    cuisine = db.Column(db.String(50))
    # Free-text cooking steps / instructions
    steps = db.Column(db.Text)

    # One-to-many relationship to recipe ingredients
    ingredients = db.relationship(
        "RecipeIngredient",
        backref="recipe",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        """Helper used in some older endpoints (not strictly required)."""
        return {
            "id": self.id,
            "name": self.name,
            "cuisine": self.cuisine,
            "steps": self.steps,
            "required_ingredients": [i.name for i in self.ingredients],
        }


class RecipeIngredient(db.Model):
    """
    Single ingredient for a Recipe.

    Example row:
    - recipe_id: 1
    - name: "egg"
    - qty: "2"
    """
    __tablename__ = "recipe_ingredients"

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipes.id"), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    qty = db.Column(db.String(50))


class WebRecipeCache(db.Model):
    """
    Cache for web search results (Google Custom Search).

    We store:
    - key: normalized ingredients + optional cuisine
    - items_json: JSON string of the recipe list we got from Google
    - created_at: when this cache entry was created/updated

    Later, discover_recipes_from_web() will:
    - read from this table before calling Google
    - write back into this table after a successful call
    """
    __tablename__ = "web_recipe_cache"

    id = db.Column(db.Integer, primary_key=True)
    # Normalized key, e.g. "beef,egg,tomato|italian"
    key = db.Column(db.String(255), nullable=False, index=True)
    # JSON string (list[dict]) representing the web recipes
    items_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

class FavoriteRecipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    cuisine = db.Column(db.String(100), nullable=True)
    source_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
