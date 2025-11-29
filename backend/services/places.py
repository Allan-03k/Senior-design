import os
import requests

GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")

def search_restaurants(cuisine: str, lat: float, lng: float, radius=2000):
    if not GOOGLE_KEY:
        print("WARNING: GOOGLE_API_KEY not set.")
        return []

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    
    keyword = f"{cuisine} restaurant"
    
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "keyword": keyword,
        "type": "restaurant",
        "key": GOOGLE_KEY
    }
    
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        results = []
        for place in data.get("results", [])[:10]:
            loc = place.get("geometry", {}).get("location", {})
            results.append({
                "name": place.get("name"),
                "rating": place.get("rating", 0.0),
                "address": place.get("vicinity"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "distance_km": 0.0 
            })
        return results
        
    except Exception as e:
        print(f"Error searching places: {e}")
        return []