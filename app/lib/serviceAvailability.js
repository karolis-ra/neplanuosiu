export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const normalized = String(timeStr).slice(0, 5);
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeStr(value) {
  const h = String(Math.floor(value / 60)).padStart(2, "0");
  const m = String(value % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function isOverlap(startA, endA, startB, endB) {
  return !(endA <= startB || endB <= startA);
}

export function buildReservationInterval({ startTime, durationMinutes }) {
  const start = timeToMinutes(startTime);
  const end = start + Number(durationMinutes || 0);

  return {
    startMinutes: start,
    endMinutes: end,
    endTime: minutesToTimeStr(end),
  };
}

export function groupServicesByType(services) {
  return {
    decorations: services.filter((item) => item.service_type === "decorations"),
    animator: services.filter((item) => item.service_type === "animator"),
    cake: services.filter((item) => item.service_type === "cake"),
  };
}

export function isProviderAvailableForReservation({
  providerAvailabilityRows,
  providerUnavailabilityRows,
  providerBookings,
  eventDate,
  weekday,
  startTime,
  endTime,
}) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const weekdayWindows = (providerAvailabilityRows || []).filter(
    (item) => item.weekday === weekday,
  );

  if (!weekdayWindows.length) {
    return false;
  }

  const fitsWeeklyAvailability = weekdayWindows.some((item) => {
    const itemStart = timeToMinutes(item.start_time);
    const itemEnd = timeToMinutes(item.end_time);
    return itemStart <= start && itemEnd >= end;
  });

  if (!fitsWeeklyAvailability) {
    return false;
  }

  const blockedByDate = (providerUnavailabilityRows || []).some((item) => {
    if (item.date !== eventDate) return false;

    const itemStart = timeToMinutes(item.start_time);
    const itemEnd = timeToMinutes(item.end_time);

    return isOverlap(start, end, itemStart, itemEnd);
  });

  if (blockedByDate) {
    return false;
  }

  const hasBookingConflict = (providerBookings || []).some((item) => {
    if (item.event_date !== eventDate) return false;

    const status = item.status;
    if (status && status === "cancelled") return false;

    const itemStart = timeToMinutes(item.start_time);
    const itemEnd = timeToMinutes(item.end_time);

    return isOverlap(start, end, itemStart, itemEnd);
  });

  return !hasBookingConflict;
}
