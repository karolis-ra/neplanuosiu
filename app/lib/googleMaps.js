function isFiniteCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCoordinatePair(latitude, longitude) {
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function parseCoordinatePair(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  );

  if (!match) {
    return null;
  }

  return normalizeCoordinatePair(Number(match[1]), Number(match[2]));
}

function decodeGoogleMapsPathSegment(value) {
  if (!value) {
    return "";
  }

  return decodeURIComponent(value).replace(/\+/g, " ").trim();
}

function extractPlaceQueryFromGoogleMapsUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  try {
    const parsedUrl = new URL(url.trim());

    for (const key of ["q", "query", "destination"]) {
      const value = parsedUrl.searchParams.get(key)?.trim();

      if (value && !parseCoordinatePair(value)) {
        return value;
      }
    }

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const placeIndex = pathParts.indexOf("place");

    if (placeIndex >= 0 && pathParts[placeIndex + 1]) {
      return decodeGoogleMapsPathSegment(pathParts[placeIndex + 1]);
    }

    const searchIndex = pathParts.indexOf("search");

    if (searchIndex >= 0 && pathParts[searchIndex + 1]) {
      return decodeGoogleMapsPathSegment(pathParts[searchIndex + 1]);
    }
  } catch {
    return "";
  }

  return "";
}

export function extractCoordinatesFromGoogleMapsUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  for (const pattern of [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ]) {
    const match = trimmedUrl.match(pattern);

    if (match) {
      const parsed = normalizeCoordinatePair(
        Number(match[1]),
        Number(match[2]),
      );

      if (parsed) {
        return parsed;
      }
    }
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    for (const key of ["q", "ll", "query"]) {
      const parsed = parseCoordinatePair(parsedUrl.searchParams.get(key));

      if (parsed) {
        return parsed;
      }
    }
  } catch {
    return parseCoordinatePair(trimmedUrl);
  }

  return null;
}

export function parseCoordinateInput(value, { min, max } = {}) {
  if (value == null) {
    return null;
  }

  const normalizedValue = String(value).trim().replace(",", ".");

  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (typeof min === "number" && parsed < min) {
    return null;
  }

  if (typeof max === "number" && parsed > max) {
    return null;
  }

  return parsed;
}

export function buildGoogleMapsEmbedUrl({
  googleMapsUrl,
  latitude,
  longitude,
  name,
  address,
  city,
  zoom,
}) {
  const placeQuery = extractPlaceQueryFromGoogleMapsUrl(googleMapsUrl);
  const fallbackQuery = [name, address, city].filter(Boolean).join(", ");
  const query = encodeURIComponent(placeQuery || fallbackQuery);

  const hasCoords =
    typeof latitude === "number" && typeof longitude === "number";

  if (placeQuery || fallbackQuery) {
    return `https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`;
  }

  if (hasCoords) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`;
  }

  if (!placeQuery && !fallbackQuery) {
    return "";
  }

  return `https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`;
}
