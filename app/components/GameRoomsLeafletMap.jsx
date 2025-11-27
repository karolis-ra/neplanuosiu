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

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [map]);

  return null;
}

// ČIA magija – kai pasikeičia center/zoom, perstatom vaizdą
function RecenterOnChange({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center.lat, center.lng, zoom]);

  return null;
}

export default function GameRoomsLeafletMap({ rooms, selectedCity }) {
  const router = useRouter();

  const validRooms = rooms.filter(
    (r) =>
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      !Number.isNaN(r.latitude) &&
      !Number.isNaN(r.longitude)
  );

  if (!validRooms.length) return null;

  const center = useMemo(() => {
    if (validRooms.length === 1) {
      return { lat: validRooms[0].latitude, lng: validRooms[0].longitude };
    }

    const avgLat =
      validRooms.reduce((s, r) => s + r.latitude, 0) / validRooms.length;
    const avgLng =
      validRooms.reduce((s, r) => s + r.longitude, 0) / validRooms.length;

    return { lat: avgLat, lng: avgLng };
  }, [validRooms]);

  const zoom = useMemo(() => {
    if (selectedCity && validRooms.length > 0) return 12; // Vilnius / kitas miestas
    if (validRooms.length === 1) return 13;
    return 7; // visa LT
  }, [selectedCity, validRooms.length]);

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

          {validRooms.map((room) => (
            <Marker
              key={room.id}
              position={{ lat: room.latitude, lng: room.longitude }}
              icon={roomIcon}
            >
              <Popup>
                <div className="ui-font text-sm space-y-1 max-w-[180px]">
                  {room.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.imageUrl}
                      alt={room.name}
                      className="mb-1 h-20 w-full rounded-md object-cover"
                    />
                  )}
                  <div className="font-semibold">{room.name}</div>
                  <div className="text-xs text-slate-600">{room.city}</div>
                  {room.price && (
                    <div className="mt-1 text-xs">nuo {room.price} €</div>
                  )}

                  <button
                    type="button"
                    onClick={() => router.push(`/kambariai/${room.id}`)}
                    className="mt-2 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90"
                  >
                    Peržiūrėti ir rezervuoti
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
