// app/components/RoomCard.jsx
"use client";

import Link from "next/link";
import FavoriteButton from "./FavoriteButton";

export default function RoomCard({ room, onFavoriteChange }) {
  const primaryImageUrl = room.primaryImageUrl;
  const city = room.venue_city || room.city || "";
  const address = room.venue_address || "";
  const name = room.venue_name || "";

  const handleToggle = (isFavorite) => {
    if (onFavoriteChange) {
      onFavoriteChange(room.id, isFavorite);
    }
  };

  return (
    <article className="relative rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="relative h-40 bg-slate-200">
        <FavoriteButton roomId={room.id} onToggle={handleToggle} />

        {primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImageUrl}
            alt={room.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary to-dark text-xs text-white ui-font">
            Nuotrauka netrukus
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 ui-font line-clamp-2">
            {room.name}
          </h3>

          {room.price != null && (
            <div className="text-right text-sm font-semibold text-primary ui-font">
              {room.price} € / val.
            </div>
          )}
        </div>
        {room.venue_name && (
          <p className="text-xs text-slate-500 ui-font line-clamp-1">
            {room.venue_name}
          </p>
        )}
        {(city || address) && (
          <p className="text-xs text-slate-500 ui-font line-clamp-1">
            {address && <span>{address}</span>}
            {address && city && <span>, </span>}
            {city && <span>{city}</span>}
          </p>
        )}

        {room.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-600 ui-font">
            {room.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {room.capacity && (
            <span className="text-xs text-slate-500 ui-font">
              Iki {room.capacity} vaikų
            </span>
          )}

          <Link
            href={`/kambariai/${room.id}`}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition ui-font"
          >
            Rezervuoti
          </Link>
        </div>
      </div>
    </article>
  );
}
