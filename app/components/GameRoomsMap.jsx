"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, X } from "lucide-react";
import ResponsiveImageFrame from "./ResponsiveImageFrame";

function toCoordinate(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(value) {
  if (value == null || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return `${parsed.toFixed(parsed % 1 === 0 ? 0 : 2)} €`;
}

function getLowestPrice(rooms) {
  const prices = (rooms || [])
    .map((room) => Number(room.price))
    .filter((price) => Number.isFinite(price));

  if (!prices.length) return "";
  return formatPrice(Math.min(...prices));
}

function getPrimaryRoom(venue) {
  return [...(venue.rooms || [])].sort((a, b) => {
    const aPrice = Number(a.price);
    const bPrice = Number(b.price);

    if (Number.isFinite(aPrice) && Number.isFinite(bPrice)) {
      return aPrice - bPrice;
    }

    if (Number.isFinite(aPrice)) return -1;
    if (Number.isFinite(bPrice)) return 1;
    return 0;
  })[0];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncateLabel(value, maxLength = 24) {
  const label = String(value || "").trim();
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function createVenuePinIcon({ name, priceLabel, isActive }) {
  const pinBackground = isActive ? "#4b2c73" : "#ffffff";
  const pinColor = isActive ? "#ffffff" : "#4b2c73";
  const labelBackground = isActive ? "#4b2c73" : "#ffffff";
  const labelColor = isActive ? "#ffffff" : "#111827";
  const secondaryColor = isActive ? "rgba(255,255,255,.78)" : "#4b5563";
  const safeName = escapeHtml(truncateLabel(name || "Vieta"));
  const safePrice = escapeHtml(priceLabel ? `nuo ${priceLabel}` : "Žiūrėti");

  return L.divIcon({
    className: "",
    html: `
      <div style="
        align-items:center;
        display:flex;
        font-family:inherit;
        gap:8px;
        transform:translateY(-8px);
      ">
        <div style="
          align-items:center;
          background:${pinBackground};
          border:2px solid #ffffff;
          border-radius:50% 50% 50% 0;
          box-shadow:0 14px 30px rgba(15,23,42,.24);
          color:${pinColor};
          display:flex;
          height:34px;
          justify-content:center;
          transform:rotate(-45deg);
          width:34px;
        ">
          <div style="
            background:${pinColor};
            border-radius:999px;
            height:10px;
            transform:rotate(45deg);
            width:10px;
          "></div>
        </div>
        <div style="
          background:${labelBackground};
          border:1px solid rgba(255,255,255,.9);
          border-radius:14px;
          box-shadow:0 12px 28px rgba(15,23,42,.18);
          color:${labelColor};
          line-height:1.15;
          max-width:178px;
          padding:8px 10px;
          white-space:nowrap;
        ">
          <div style="
            font-size:12px;
            font-weight:800;
            max-width:154px;
            overflow:hidden;
            text-overflow:ellipsis;
          ">${safeName}</div>
          <div style="
            color:${secondaryColor};
            font-size:11px;
            font-weight:700;
            margin-top:3px;
          ">${safePrice}</div>
        </div>
      </div>
    `,
    iconSize: [230, 48],
    iconAnchor: [18, 40],
  });
}

function MapViewport({ venues, selectedCity }) {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize();
    resize();

    const resizeTimer = window.setTimeout(resize, 120);
    window.addEventListener("resize", resize);

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resize);
    };
  }, [map]);

  useEffect(() => {
    if (!venues.length) return;

    const fitMap = () => {
      map.invalidateSize();

      if (venues.length === 1) {
        map.setView([venues[0].latitude, venues[0].longitude], 13);
        return;
      }

      const bounds = L.latLngBounds(
        venues.map((venue) => [venue.latitude, venue.longitude]),
      );
      const isCompact = window.innerWidth < 640;

      map.fitBounds(bounds, {
        maxZoom: selectedCity ? 13 : 8,
        paddingTopLeft: isCompact ? [28, 96] : [64, 96],
        paddingBottomRight: isCompact ? [28, 270] : [64, 180],
      });
    };

    fitMap();
    const fitTimer = window.setTimeout(fitMap, 160);

    return () => window.clearTimeout(fitTimer);
  }, [map, selectedCity, venues]);

  return null;
}

function RecenterButton({ activeVenue }) {
  const map = useMap();

  if (!activeVenue) return null;

  return (
    <button
      type="button"
      onClick={() => {
        map.flyTo(
          [activeVenue.latitude, activeVenue.longitude],
          Math.max(map.getZoom(), 13),
          { duration: 0.6 },
        );
      }}
      className="absolute bottom-5 right-4 z-[1000] inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 transition hover:bg-slate-50"
      aria-label="Grįžti prie pasirinktos vietos"
    >
      <Navigation size={19} fill="currentColor" />
    </button>
  );
}

export default function GameRoomsMap({ rooms, selectedCity, onClose }) {
  const router = useRouter();
  const [activeVenueId, setActiveVenueId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const venues = useMemo(
    () =>
      (rooms || [])
        .map((venue) => ({
          ...venue,
          latitude: toCoordinate(venue.latitude),
          longitude: toCoordinate(venue.longitude),
        }))
        .filter(
          (venue) =>
            venue.latitude != null &&
            venue.longitude != null &&
            venue.latitude >= -90 &&
            venue.latitude <= 90 &&
            venue.longitude >= -180 &&
            venue.longitude <= 180,
        ),
    [rooms],
  );

  const activeVenue = venues.find((venue) => venue.id === activeVenueId) || null;
  const selectedRoom = activeVenue
    ? activeVenue.rooms?.find((room) => room.id === selectedRoomId) ||
      getPrimaryRoom(activeVenue)
    : null;
  const lowestPrice = activeVenue ? getLowestPrice(activeVenue.rooms) : "";
  const initialCenter = useMemo(() => {
    if (!venues.length) return [54.6872, 25.2797];

    const avgLat =
      venues.reduce((sum, venue) => sum + venue.latitude, 0) / venues.length;
    const avgLng =
      venues.reduce((sum, venue) => sum + venue.longitude, 0) / venues.length;

    return [avgLat, avgLng];
  }, [venues]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!venues.length) {
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 px-4">
        <div className="max-w-sm rounded-[24px] bg-white p-6 text-center shadow-2xl">
          <p className="ui-font text-base font-semibold text-slate-900">
            Žemėlapiui trūksta koordinačių
          </p>
          <p className="ui-font mt-2 text-sm text-slate-600">
            Šiuo metu neradome kambarių su tikslia lokacija.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ui-font mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Uždaryti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] bg-slate-100">
      <MapContainer
        center={initialCenter}
        zoom={selectedCity ? 11 : 7}
        scrollWheelZoom
        zoomControl
        className="absolute inset-0 z-0 h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          opacity={0.94}
        />

        <MapViewport venues={venues} selectedCity={selectedCity} />

        {venues.map((venue) => {
          const isActive = venue.id === activeVenue?.id;

          return (
            <Marker
              key={venue.id}
              position={[venue.latitude, venue.longitude]}
              icon={createVenuePinIcon({
                name: venue.venueName,
                priceLabel: getLowestPrice(venue.rooms),
                isActive,
              })}
              eventHandlers={{
                click: () => {
                  setActiveVenueId(venue.id);
                  setSelectedRoomId(getPrimaryRoom(venue)?.id || "");
                },
              }}
            />
          );
        })}

        <RecenterButton activeVenue={activeVenue} />
      </MapContainer>

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-white/95 via-white/70 to-transparent px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="ui-font text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Žemėlapis
            </p>
            <h2 className="heading text-xl font-bold text-slate-950 sm:text-2xl">
              Žaidimų kambariai šalia jūsų
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Uždaryti žemėlapį"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {activeVenue && (
        <article className="absolute left-4 right-4 top-1/2 z-20 flex max-h-[min(680px,calc(100vh-112px))] -translate-y-1/2 flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200/80 sm:bottom-auto sm:left-6 sm:right-auto sm:top-[116px] sm:w-[370px] sm:max-h-[calc(100vh-140px)] sm:translate-y-0">
          <button
            type="button"
            onClick={() => {
              setActiveVenueId("");
              setSelectedRoomId("");
            }}
            className="absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-50"
            aria-label="Uždaryti vietos kortelę"
          >
            <X size={18} strokeWidth={2.2} />
          </button>

          <ResponsiveImageFrame
            src={selectedRoom?.imageUrl}
            alt={selectedRoom?.name || activeVenue.venueName}
            ratio="16 / 9"
            className="shrink-0 rounded-none"
            placeholder="Nuotrauka netrukus"
          />

          <div className="overflow-y-auto p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={`/tiekejai/${activeVenue.id}`}
                  className="ui-font line-clamp-2 text-lg font-bold text-slate-950 transition hover:text-primary"
                >
                  {activeVenue.venueName}
                </Link>
                <p className="ui-font mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <MapPin size={15} />
                  <span className="line-clamp-1">
                    {[activeVenue.address, activeVenue.city]
                      .filter(Boolean)
                      .join(", ") || "Lokacija nenurodyta"}
                  </span>
                </p>
              </div>

              {lowestPrice && (
                <div className="ui-font shrink-0 text-right text-sm font-semibold text-slate-950">
                  nuo
                  <span className="block text-lg text-primary">
                    {lowestPrice}
                  </span>
                </div>
              )}
            </div>

            {activeVenue.rooms?.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="ui-font text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Kambariai
                  </p>
                  <p className="ui-font text-xs text-slate-500">
                    {activeVenue.rooms.length > 1
                      ? `${activeVenue.rooms.length} pasirinkimai`
                      : "1 pasirinkimas"}
                  </p>
                </div>

                <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-2">
                  {activeVenue.rooms.map((room) => {
                    const isSelected = room.id === selectedRoom?.id;

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`ui-font min-w-[210px] rounded-[16px] border p-2 text-left transition ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
                        }`}
                      >
                        <div className="flex gap-2">
                          <div className="w-[64px] shrink-0">
                            <ResponsiveImageFrame
                              src={room.imageUrl}
                              alt={room.name}
                              ratio="4 / 3"
                              className="rounded-[12px]"
                              placeholder=""
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                              {room.name}
                            </p>
                            {room.price != null && (
                              <p className="mt-1 text-xs font-semibold text-primary">
                                {formatPrice(room.price)} / val.
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedRoom && (
              <div className="mt-1 rounded-[16px] bg-slate-50 p-3">
                <p className="ui-font line-clamp-1 text-sm font-semibold text-slate-900">
                  {selectedRoom.name}
                </p>
                <p className="ui-font mt-1 text-xs text-slate-500">
                  {activeVenue.rooms.length > 1
                    ? `${activeVenue.rooms.length} kambariai šioje vietoje`
                    : "1 kambarys šioje vietoje"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (selectedRoom?.id) {
                  router.push(`/kambariai/${selectedRoom.id}`);
                }
              }}
              className="ui-font mt-4 inline-flex h-12 w-full items-center justify-center rounded-[16px] bg-primary px-4 text-sm font-bold text-white shadow-md transition hover:bg-dark"
            >
              Peržiūrėti pasirinktą kambarį
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
