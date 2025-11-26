"use client";

export default function RoomInfo({ room, venue }) {
  if (!room || !venue) return null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm space-y-6">
      {/* --- Pavadinimas ir pagrindinė info --- */}
      <div>
        <h1 className="heading text-2xl font-bold text-dark mb-2">
          {room.name}
        </h1>

        <div className="text-sm text-gray-600 ui-font">
          <p>
            {room.city} • Talpa iki {room.capacity} vaikų • Amžius{" "}
            {room.min_age}–{room.max_age} m.
          </p>
        </div>
      </div>

      {/* --- Aprašymas --- */}
      <div>
        <h2 className="font-semibold text-lg text-dark mb-1 ui-font">
          Aprašymas
        </h2>
        <p className="text-gray-700 leading-relaxed ui-font whitespace-pre-line">
          {room.description}
        </p>
      </div>

      {/* --- Trukmė ir kaina --- */}
      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
        <div>
          <p className="text-sm text-gray-500 ui-font">Trukmė</p>
          <p className="font-semibold text-dark">{room.duration_minutes} min</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 ui-font">Kaina nuo</p>
          <p className="font-semibold text-primary">
            {room.price.toFixed(2)} €
          </p>
        </div>
      </div>

      {/* --- Vieta --- */}
      <div className="space-y-1">
        <h2 className="font-semibold text-lg text-dark mb-1 ui-font">Vieta</h2>

        <p className="text-sm text-gray-700 ui-font">
          <span className="font-semibold">{venue.name}</span>
          <br />
          {venue.address}, {venue.city}
        </p>
      </div>

      {/* --- Kontaktai --- */}
      <div className="space-y-1">
        <h2 className="font-semibold text-lg text-dark mb-1 ui-font">
          Kontaktai
        </h2>

        <p className="text-sm text-gray-700 ui-font">
          📞 {venue.phone || "Nenurodytas"} <br />
          📧 {venue.email || "Nenurodytas"}
        </p>

        {venue.website && (
          <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm ui-font"
          >
            🌐 Svetainė
          </a>
        )}
      </div>
    </div>
  );
}
