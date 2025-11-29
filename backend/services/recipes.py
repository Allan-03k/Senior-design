from models import Recipe, db
from schemas.dto import RecipeItem, ShoppingListItem

def recommend_recipes(user_ingredients: list[str], threshold=0.5):
    user_set = set(i.lower().strip() for i in user_ingredients)
    all_recipes = Recipe.query.all()
    results = []

    for r in all_recipes:
        # Get all the ingredient names needed for this recipe
        req_list = [i.name.lower() for i in r.ingredients]
        req_set = set(req_list)
        
        if not req_set:
            continue
            
        overlap = len(user_set & req_set)
        ratio = overlap / len(req_set)
        
        if ratio >= threshold:
            results.append(RecipeItem(
                id=r.id,
                name=r.name,
                cuisine=r.cuisine or "General",
                match_ratio=round(ratio, 2),
                required_ingredients=req_list,
                steps=r.steps or ""
            ))
            
    results.sort(key=lambda x: x.match_ratio, reverse=True)
    return results

def get_shopping_missing(recipe_id: int, user_ingredients: list[str]):
    """
    Calculate the missing ingredients
    """
    recipe = db.session.get(Recipe, recipe_id)
    if not recipe:
        return None
        
    user_set = set(i.lower().strip() for i in user_ingredients)
    missing = []
    
    for item in recipe.ingredients:
        if item.name.lower() not in user_set:
            missing.append(ShoppingListItem(
                ingredient=item.name, 
                qty=item.qty
            ))
            
    return missing