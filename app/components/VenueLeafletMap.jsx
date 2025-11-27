"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const DEFAULT_ZOOM = 16;

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function VenueLeafletMap({ venue }) {
  const { name, address, city, latitude, longitude } = venue || {};

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const position = [latitude, longitude];

  return (
    <div className="mt-4 space-y-2">
      <h2 className="ui-font text-lg font-semibold">Lokacija žemėlapyje</h2>
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <MapContainer
          center={position}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          className="h-72 w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={defaultIcon}>
            <Popup>
              <div className="ui-font text-sm">
                <div className="font-semibold">{name}</div>
                <div>{address}</div>
                <div>{city}</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
