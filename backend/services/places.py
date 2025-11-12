def search_restaurants(cuisine: str, lat: float, lng: float):
    # TODO: 改为 Yelp / Google Maps Places
    return [
        {"name": f"{cuisine} Bistro", "rating": 4.5, "distance_km": 1.2, "lat": lat, "lng": lng},
        {"name": f"{cuisine} Kitchen", "rating": 4.2, "distance_km": 2.1, "lat": lat, "lng": lng},
    ]
