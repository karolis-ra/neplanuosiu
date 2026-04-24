"use client";

const WEEKDAY_LABELS = {
  0: "Sekmadienis",
  1: "Pirmadienis",
  2: "Antradienis",
  3: "Trečiadienis",
  4: "Ketvirtadienis",
  5: "Penktadienis",
  6: "Šeštadienis",
};

function formatAvailability(availability = []) {
  if (!availability.length) return [];

  return [...availability]
    .sort((a, b) => a.weekday - b.weekday)
    .map((item) => {
      const startTime = String(item.start_time || "").slice(0, 5);
      const endTime = String(item.end_time || "").slice(0, 5);

      return `${WEEKDAY_LABELS[item.weekday] || "Diena"} ${startTime}-${endTime}`;
    });
}

export default function RoomInfo({ room, venue, availability = [] }) {
  if (!room || !venue) return null;

  const availabilityLines = formatAvailability(availability);

  return (
    <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
      <div>
        <h1 className="heading mb-2 text-2xl font-bold text-dark">
          {room.name}
        </h1>

        <div className="ui-font text-sm text-gray-600">
          <p>
            {room.city} • Talpa iki {room.capacity} vaikų • Amžius{" "}
            {room.min_age ?? "-"}-{room.max_age ?? "-"} m.
          </p>
        </div>
      </div>

      <div>
        <h2 className="ui-font mb-1 text-lg font-semibold text-dark">
          Aprašymas
        </h2>
        <p className="ui-font whitespace-pre-line leading-relaxed text-gray-700">
          {room.description || "Aprašymas nepateiktas."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4">
        <div>
          <p className="ui-font text-sm text-gray-500">
            Minimali rezervacija
          </p>
          <p className="font-semibold text-dark">{room.duration_minutes} min</p>
        </div>
        <div>
          <p className="ui-font text-sm text-gray-500">Kaina nuo</p>
          <p className="font-semibold text-primary">
            {Number(room.price || 0).toFixed(2)} €
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="ui-font mb-1 text-lg font-semibold text-dark">Vieta</h2>

        <p className="ui-font text-sm text-gray-700">
          <span className="font-semibold">{venue.name}</span>
          <br />
          {venue.address || "Adresas nenurodytas"}
          {venue.city ? `, ${venue.city}` : ""}
        </p>
      </div>

      <div className="space-y-1">
        <h2 className="ui-font mb-1 text-lg font-semibold text-dark">
          Kontaktai
        </h2>

        <p className="ui-font text-sm text-gray-700">
          Telefonas: {venue.phone || "Nenurodytas"} <br />
          El. paštas: {venue.email || "Nenurodytas"}
        </p>

        {venue.website && (
          <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-font text-sm text-primary hover:underline"
          >
            Svetainė
          </a>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="ui-font mb-1 text-lg font-semibold text-dark">
          Darbo laikas
        </h2>

        {availabilityLines.length > 0 ? (
          <div className="space-y-1">
            {availabilityLines.map((line) => (
              <p key={line} className="ui-font text-sm text-gray-700">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="ui-font text-sm text-gray-700">
            Darbo laikas nenurodytas.
          </p>
        )}
      </div>
    </div>
  );
}
