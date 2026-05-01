import math
import os
from typing import Any, Dict, List, Optional

import requests

GOOGLE_KEY = os.getenv("GOOGLE_API_KEY")

# Places API (New) — avoids legacy Nearby/Text endpoints disabled on many new projects
PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"

# Legacy Geocoding (optional); Nominatim used as fallback when disabled or failing
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Field mask required by Places API (New)
_PLACES_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.currentOpeningHours",
        "places.photos",
        "places.nationalPhoneNumber",
        "places.websiteUri",
    ]
)

NOMINATIM_UA = "SmartEats-SeniorDesign/1.0 (https://github.com/; student demo)"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return round(r * c, 2)


def _price_level_new_api(level: Any) -> str:
    """Map Places API (New) PRICE_LEVEL_* enum to $ string."""
    if level is None:
        return ""
    s = str(level)
    mapping = {
        "PRICE_LEVEL_INEXPENSIVE": "$",
        "PRICE_LEVEL_MODERATE": "$$",
        "PRICE_LEVEL_EXPENSIVE": "$$$",
        "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$",
        "PRICE_LEVEL_FREE": "",
    }
    return mapping.get(s, "")


def _new_place_to_row(
    place: Dict[str, Any],
    origin_lat: float,
    origin_lng: float,
) -> Optional[Dict[str, Any]]:
    loc = place.get("location") or {}
    plat = loc.get("latitude")
    plng = loc.get("longitude")
    pid = place.get("id")
    if plat is None or plng is None:
        return None

    plat_f, plng_f = float(plat), float(plng)
    distance_km = _haversine_km(origin_lat, origin_lng, plat_f, plng_f)

    dn = place.get("displayName") or {}
    name = dn.get("text") if isinstance(dn, dict) else str(dn or "")

    maps_query = f"https://www.google.com/maps/search/?api=1&query={plat_f},{plng_f}"
    if pid:
        maps_query = f"https://www.google.com/maps/search/?api=1&query_place_id={pid}"

    hours = place.get("currentOpeningHours") or {}
    open_now = hours.get("openNow")

    # Build photo URL — stays server-side so the key never leaves the backend response
    photo_url = None
    photos = place.get("photos") or []
    if photos and GOOGLE_KEY:
        photo_name = (photos[0] or {}).get("name")
        if photo_name:
            photo_url = (
                f"https://places.googleapis.com/v1/{photo_name}/media"
                f"?maxWidthPx=400&key={GOOGLE_KEY}"
            )

    return {
        "name": name or "Restaurant",
        "rating": place.get("rating"),
        "user_ratings_total": place.get("userRatingCount"),
        "address": place.get("formattedAddress"),
        "lat": plat_f,
        "lng": plng_f,
        "place_id": pid,
        "maps_url": maps_query,
        "distance_km": distance_km,
        "open_now": open_now,
        "price_level": place.get("priceLevel"),
        "price_label": _price_level_new_api(place.get("priceLevel")),
        "photo_url": photo_url,
        "phone": place.get("nationalPhoneNumber"),
        "website": place.get("websiteUri"),
    }


def search_restaurants(
    cuisine: str,
    lat: float,
    lng: float,
    radius: int = 2000,
) -> Dict[str, Any]:
    """
    Restaurant search via Places API (New) Text Search + location restriction.
    """
    if not GOOGLE_KEY:
        return {
            "results": [],
            "status": "NO_API_KEY",
            "error_message": "Set GOOGLE_API_KEY in backend/.env",
        }

    radius_m = float(max(500, min(int(radius), 50000)))
    text_query = f"{cuisine.strip()} restaurant"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": _PLACES_FIELD_MASK,
    }

    # Places API (New): locationRestriction only accepts rectangle; circle is
    # only valid inside locationBias.  We use locationBias + haversine
    # post-filter to stay within the requested radius.
    body: Dict[str, Any] = {
        "textQuery": text_query,
        "maxResultCount": 20,
        "locationBias": {
            "circle": {
                "center": {"latitude": float(lat), "longitude": float(lng)},
                "radius": radius_m,
            }
        },
    }

    try:
        resp = requests.post(
            PLACES_SEARCH_TEXT_URL,
            headers=headers,
            json=body,
            timeout=15,
        )
    except Exception as e:
        return {"results": [], "status": "HTTP_ERROR", "error_message": str(e)}

    if resp.status_code != 200:
        try:
            payload = resp.json()
            err = payload.get("error") or {}
            error_message = err.get("message") or resp.text[:500]
            status = err.get("status") or f"HTTP_{resp.status_code}"
        except Exception:
            error_message = resp.text[:500] if resp.text else str(resp.status_code)
            status = f"HTTP_{resp.status_code}"
        return {"results": [], "status": status, "error_message": error_message}

    places = resp.json().get("places") or []

    rows: List[Dict[str, Any]] = []
    for p in places:
        row = _new_place_to_row(p, lat, lng)
        if row and (row["distance_km"] * 1000) <= radius_m * 1.15:
            rows.append(row)

    rows.sort(key=lambda x: x.get("distance_km", 9999))
    rows = rows[:15]

    if not rows:
        return {
            "results": [],
            "status": "ZERO_RESULTS",
            "error_message": "",
        }

    return {"results": rows, "status": "OK", "error_message": ""}


def _geocode_google(address: str) -> Optional[Dict[str, Any]]:
    if not GOOGLE_KEY:
        return None
    params = {"address": address.strip(), "key": GOOGLE_KEY}
    try:
        resp = requests.get(GEOCODE_URL, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None
    if data.get("status") != "OK":
        return None
    results = data.get("results") or []
    if not results:
        return None
    loc = results[0].get("geometry", {}).get("location", {}) or {}
    la, ln = loc.get("lat"), loc.get("lng")
    if la is None or ln is None:
        return None
    return {
        "lat": float(la),
        "lng": float(ln),
        "formatted_address": results[0].get("formatted_address", ""),
        "place_id": results[0].get("place_id"),
        "source": "google_geocoding",
    }


def _geocode_nominatim(address: str) -> Optional[Dict[str, Any]]:
    """Free fallback; respects Nominatim usage policy (identifying User-Agent)."""
    q = (address or "").strip()
    if not q:
        return None
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": q, "format": "json", "limit": 1},
            headers={"User-Agent": NOMINATIM_UA},
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None
    if not data:
        return None
    item = data[0]
    return {
        "lat": float(item["lat"]),
        "lng": float(item["lon"]),
        "formatted_address": item.get("display_name", q),
        "place_id": None,
        "source": "openstreetmap_nominatim",
    }


def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """
    Resolve free text to coordinates.
    Tries Google Geocoding first (if key + API enabled), then OpenStreetMap Nominatim.
    """
    if not address or not str(address).strip():
        return None

    out = _geocode_google(address)
    if out:
        return out
    return _geocode_nominatim(address)
