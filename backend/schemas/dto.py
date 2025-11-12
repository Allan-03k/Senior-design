from pydantic import BaseModel, Field, ValidationError, field_validator
from typing import List, Dict, Optional

class RecognizeResponse(BaseModel):
    ingredients: List[str]
    freshness: Dict[str, str]

class RecommendRequest(BaseModel):
    ingredients: List[str] = Field(min_length=1)

    @field_validator("ingredients")
    @classmethod
    def norm(cls, v):
        return [s.strip().lower() for s in v if s.strip()]

class RecipeItem(BaseModel):
    id: int
    name: str
    cuisine: str
    match_ratio: float
    required_ingredients: List[str]
    steps: str

class RecommendResponse(BaseModel):
    recipes: List[RecipeItem]

class ShoppingListRequest(BaseModel):
    recipe_id: int
    ingredients: List[str]

class ShoppingListItem(BaseModel):
    ingredient: str
    qty: Optional[str] = None

class ShoppingListResponse(BaseModel):
    missing: List[ShoppingListItem]
