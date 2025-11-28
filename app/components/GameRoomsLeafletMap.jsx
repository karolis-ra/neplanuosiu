// app/components/map/GameRoomsLeafletMap.jsx
"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

const roomIcon = L.icon({
  iconUrl: "/icons/room-pin.svg",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

function CtrlScrollZoom() {
  const map = useMap();

  useEffect(() => {
    map.scrollWheelZoom.disable();

    function handleWheel(e) {
      if (e.ctrlKey) {
        e.preventDefault();
        map.scrollWheelZoom.enable();
      } else {
        map.scrollWheelZoom.disable();
      }
    }

    const container = map.getContainer();
    container.addEventListener("wheel", handleWheel);

    return () => container.removeEventListener("wheel", handleWheel);
  }, [map]);

  return null;
}

function RecenterOnChange({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

export default function GameRoomsLeafletMap({ rooms, selectedCity }) {
  const router = useRouter();

  const venues = rooms.filter(
    (v) =>
      typeof v.latitude === "number" &&
      typeof v.longitude === "number" &&
      !Number.isNaN(v.latitude) &&
      !Number.isNaN(v.longitude)
  );

  if (!venues.length) return null;

  const center = useMemo(() => {
    if (venues.length === 1) {
      return { lat: venues[0].latitude, lng: venues[0].longitude };
    }
    const avgLat = venues.reduce((s, v) => s + v.latitude, 0) / venues.length;
    const avgLng = venues.reduce((s, v) => s + v.longitude, 0) / venues.length;
    return { lat: avgLat, lng: avgLng };
  }, [venues]);

  const zoom = useMemo(() => {
    if (selectedCity && venues.length > 0) return 12;
    if (venues.length === 1) return 13;
    return 7;
  }, [selectedCity, venues.length]);

  return (
    <div className="mt-4 space-y-2">
      <h2 className="ui-font text-lg font-semibold">
        Žaidimų kambariai žemėlapyje
      </h2>
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          className="h-80 w-full"
        >
          <CtrlScrollZoom />
          <RecenterOnChange center={center} zoom={zoom} />

          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {venues.map((venue) => (
            <Marker
              key={venue.id}
              position={{ lat: venue.latitude, lng: venue.longitude }}
              icon={roomIcon}
            >
              <Popup>
                <div className="ui-font text-sm space-y-2 max-w-[220px]">
                  <div className="font-semibold">{venue.venueName}</div>
                  <div className="text-xs text-slate-600">{venue.city}</div>

                  {venue.rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => router.push(`/kambariai/${room.id}`)}
                      className="flex gap-2 rounded-lg bg-slate-50 p-1.5 text-left hover:bg-slate-100"
                    >
                      {room.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={room.imageUrl}
                          alt={room.name}
                          className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">
                          {room.name}
                        </span>
                        {room.price && (
                          <span className="text-[11px] text-slate-600">
                            nuo {room.price} € / val.
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
