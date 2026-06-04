"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MapPin } from "lucide-react";
import ResponsiveImageFrame from "./ResponsiveImageFrame";
import ServiceDetailsModal from "./ServiceDetailsModal";

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(amount % 1 === 0 ? 0 : 2)} €`;
}

function getServiceTypeLabel(type) {
  if (type === "decorations") return "Dekoracijos";
  if (type === "animator") return "Animatorius";
  if (type === "cake") return "Tortas";
  return type || "Paslauga";
}

function cleanValue(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "nenurodyta") return "";
  return text;
}

export default function ProviderProfileClient({
  provider,
  venue,
  rooms = [],
  services = [],
}) {
  const roomsRef = useRef(null);
  const [activeService, setActiveService] = useState(null);
  const [showRoomPrompt, setShowRoomPrompt] = useState(false);

  const displayName =
    cleanValue(provider?.name) || cleanValue(venue?.name) || "Partneris";
  const description = cleanValue(provider?.description || venue?.description);
  const locationParts = [
    cleanValue(provider?.address || venue?.address),
    cleanValue(provider?.city || venue?.city),
  ].filter(Boolean);
  const heroImage = rooms[0]?.primaryImageUrl || services[0]?.image_url;
  const hasRooms = rooms.length > 0;

  function scrollToRooms() {
    setShowRoomPrompt(true);
    roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleServiceSelect() {
    setActiveService(null);
    if (hasRooms) scrollToRooms();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_.92fr]">
          <div className="p-6 sm:p-8">
            <p className="ui-font text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Partneris
            </p>
            <h1 className="heading mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
              {displayName}
            </h1>

            {locationParts.length > 0 && (
              <p className="ui-font mt-4 flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={17} />
                <span>{locationParts.join(", ")}</span>
              </p>
            )}

            {description && (
              <p className="ui-font mt-5 max-w-2xl whitespace-pre-line text-sm leading-6 text-slate-600">
                {description}
              </p>
            )}
          </div>

          <div className="bg-slate-100">
            <ResponsiveImageFrame
              src={heroImage}
              alt={displayName}
              ratio="16 / 10"
              className="h-full min-h-[260px] rounded-none"
              placeholder="Nuotrauka netrukus"
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section
          ref={roomsRef}
          className="scroll-mt-24 rounded-[28px] border border-slate-200/80 bg-white/70 p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="heading text-2xl font-bold text-slate-950">
                {showRoomPrompt
                  ? "Pasirinkite žaidimų kambarį"
                  : "Žaidimų erdvė ir kambariai"}
              </h2>
              {venue && (
                <p className="ui-font mt-1 text-sm text-slate-600">
                  {[cleanValue(venue.name), cleanValue(venue.city)]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            {showRoomPrompt && (
              <span className="ui-font rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
                Pasirinkite kambarį rezervacijai
              </span>
            )}
          </div>

          {rooms.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {rooms.map((room) => {
                const roomDescription = cleanValue(room.description);

                return (
                  <article
                    key={room.id}
                    className="overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link href={`/kambariai/${room.id}`} className="block">
                      <ResponsiveImageFrame
                        src={room.primaryImageUrl}
                        alt={room.name}
                        ratio="4 / 3"
                        className="rounded-t-[24px]"
                        placeholder="Nuotrauka netrukus"
                      />
                    </Link>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="ui-font line-clamp-2 text-base font-semibold text-slate-950">
                          {room.name}
                        </h3>
                        {room.price != null && (
                          <p className="ui-font shrink-0 text-sm font-semibold text-primary">
                            {formatPrice(room.price)} / val.
                          </p>
                        )}
                      </div>
                      {roomDescription && (
                        <p className="ui-font mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                          {roomDescription}
                        </p>
                      )}
                      <Link
                        href={`/kambariai/${room.id}`}
                        className="ui-font mt-4 inline-flex h-11 w-full items-center justify-center rounded-[15px] bg-primary px-4 text-sm font-bold text-white transition hover:bg-dark"
                      >
                        PLAČIAU
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ui-font mt-4 rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm">
              Šis partneris žaidimų kambarių dar nepaskelbė.
            </div>
          )}
        </section>

        <section
          id="paslaugos"
          className="scroll-mt-24 rounded-[28px] border border-slate-200/80 bg-white/70 p-4 shadow-sm sm:p-5"
        >
          <div>
            <h2 className="heading text-2xl font-bold text-slate-950">
              Paslaugos
            </h2>
            <p className="ui-font mt-1 text-sm text-slate-600">
              Papildomi pasiūlymai iš šio partnerio.
            </p>
          </div>

          {services.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {services.map((service) => {
                const serviceDescription = cleanValue(
                  service.short_description || service.description
                );

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setActiveService(service)}
                    className="overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <ResponsiveImageFrame
                      src={service.image_url}
                      alt={service.name}
                      ratio="4 / 3"
                      className="rounded-t-[24px]"
                      placeholder="Paslaugos nuotrauka"
                    />
                    <div className="p-4">
                      <p className="ui-font text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        {getServiceTypeLabel(service.service_type)}
                      </p>
                      <h3 className="ui-font mt-1 line-clamp-2 text-base font-semibold text-slate-950">
                        {service.name}
                      </h3>
                      {serviceDescription && (
                        <p className="ui-font mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                          {serviceDescription}
                        </p>
                      )}
                      <p className="ui-font mt-4 text-sm font-semibold text-primary">
                        {formatPrice(service.price_per_unit)}
                      </p>
                      <span className="ui-font mt-4 inline-flex h-11 w-full items-center justify-center rounded-[15px] bg-primary px-4 text-sm font-bold text-white transition hover:bg-dark">
                        PLAČIAU
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ui-font mt-4 rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm">
              Šis partneris paslaugų dar nepaskelbė.
            </div>
          )}
        </section>
      </div>

      <ServiceDetailsModal
        open={Boolean(activeService)}
        service={activeService}
        onClose={() => setActiveService(null)}
        onSelect={handleServiceSelect}
      />
    </div>
  );
}
