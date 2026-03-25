import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng, map]);
  return null;
}

export default function RestaurantMap({
  centerLat,
  centerLng,
  radiusM,
  restaurants,
}) {
  const safeLat = Number(centerLat) || 0;
  const safeLng = Number(centerLng) || 0;

  return (
    <div className="rounded-3 overflow-hidden border shadow-sm">
      <MapContainer
        center={[safeLat, safeLng]}
        zoom={13}
        className="restaurant-map"
        style={{ height: 360, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={safeLat} lng={safeLng} />
        <Circle
          center={[safeLat, safeLng]}
          radius={Math.max(300, Number(radiusM) || 2000)}
          pathOptions={{
            color: "#dc3545",
            weight: 2,
            fillColor: "#dc3545",
            fillOpacity: 0.06,
          }}
        />
        <Marker position={[safeLat, safeLng]}>
          <Popup>Search center · adjust via address or GPS</Popup>
        </Marker>
        {(restaurants || []).map((r) => {
          if (r.lat == null || r.lng == null) return null;
          return (
            <Marker key={r.place_id || `${r.lat}-${r.lng}-${r.name}`} position={[r.lat, r.lng]}>
              <Popup>
                <strong>{r.name}</strong>
                <br />
                {r.address || ""}
                {typeof r.distance_km === "number" && (
                  <>
                    <br />
                    {(r.distance_km < 1
                      ? `${Math.round(r.distance_km * 1000)} m`
                      : `${r.distance_km} km`)}{" "}
                    from center
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
