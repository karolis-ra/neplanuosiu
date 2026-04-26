"use client";

import {
  buildGoogleMapsEmbedUrl,
  extractCoordinatesFromGoogleMapsUrl,
} from "../lib/googleMaps";

const DEFAULT_ZOOM = 17;

export default function VenueMap({
  name,
  address,
  city,
  googleMapsUrl,
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
}) {
  const urlCoordinates = extractCoordinatesFromGoogleMapsUrl(googleMapsUrl);
  const resolvedLatitude = urlCoordinates?.latitude ?? latitude;
  const resolvedLongitude = urlCoordinates?.longitude ?? longitude;
  const hasLocationQuery = Boolean(name || address || city);

  const hasCoords =
    typeof resolvedLatitude === "number" &&
    typeof resolvedLongitude === "number";

  if (!hasLocationQuery && !hasCoords && !googleMapsUrl) {
    return null;
  }

  const src = buildGoogleMapsEmbedUrl({
    googleMapsUrl,
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    name,
    address,
    city,
    zoom,
  });

  const externalMapUrl =
    googleMapsUrl?.trim() ||
    (hasCoords
      ? `https://www.google.com/maps?q=${resolvedLatitude},${resolvedLongitude}&z=${zoom}`
      : buildGoogleMapsEmbedUrl({
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          name,
          address,
          city,
          zoom,
        }).replace("&output=embed", ""));

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ui-font text-lg font-semibold">Lokacija žemėlapyje</h2>
        <a
          href={externalMapUrl}
          target="_blank"
          rel="noreferrer"
          className="ui-font text-sm font-medium text-primary transition hover:text-dark"
        >
          Atidaryti „Google Maps“
        </a>
      </div>

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
