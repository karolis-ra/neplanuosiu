"use client";

const DEFAULT_ZOOM = 17;

export default function VenueMap({
  name,
  address,
  city,
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
}) {
  if (!address && !city && (!latitude || !longitude)) return null;

  const hasCoords =
    typeof latitude === "number" && typeof longitude === "number";

  const query = encodeURIComponent(
    [name, address, city].filter(Boolean).join(", ")
  );

  const src = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`
    : `https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`;

  return (
    <div className="mt-4 space-y-2">
      <h2 className="ui-font text-lg font-semibold">Lokacija žemėlapyje</h2>
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <iframe
          title={`Žemėlapis: ${name}`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-72 w-full"
        />
      </div>
    </div>
  );
}
