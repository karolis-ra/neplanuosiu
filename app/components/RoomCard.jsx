// app/components/RoomCard.js
import Link from "next/link";
import FavoriteButton from "./FavoriteButton";

export default function RoomCard({ room }) {
  const {
    id, // 👈 svarbu: čia turi būti room.id iš DB
    name,
    city,
    capacity,
    description,
    price,
    primaryImageUrl,
  } = room;

  return (
    <article className="rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="relative h-40 bg-slate-200">
        <FavoriteButton roomId={room.id} />
        {primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary to-dark text-xs text-white ui-font">
            Nuotrauka netrukus
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="heading mb-1 text-base font-semibold text-dark">
          {name}
        </h3>
        <p className="ui-font text-xs text-slate-500 mb-2">
          {city} • iki {capacity || "?"} vaikų
        </p>
        <p className="ui-font mb-3 line-clamp-3 text-xs text-slate-700">
          {description}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <span className="heading text-sm font-semibold text-primary">
            {price ? `${price} €` : "Kaina sutartinė"}
          </span>

          {/* 👇 ČIA SVARBIAUSIA VIETA */}
          <Link
            href={`/kambariai/${room.id}`}
            className="ui-font rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-dark"
          >
            Rezervuoti
          </Link>
        </div>
      </div>
    </article>
  );
}
