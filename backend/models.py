from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

class Recipe(db.Model):
    __tablename__ = 'recipes'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    cuisine = db.Column(db.String(50))
    steps = db.Column(db.Text) #cooking step
    
    ingredients = db.relationship('RecipeIngredient', backref='recipe', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "cuisine": self.cuisine,
            "steps": self.steps,
            "required_ingredients": [i.name for i in self.ingredients]
        }

class RecipeIngredient(db.Model):
    __tablename__ = 'recipe_ingredients'
    
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipes.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    qty = db.Column(db.String(50))