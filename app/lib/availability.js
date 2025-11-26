// app/lib/availability.js

export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isOverlap(startA, endA, startB, endB) {
  return !(endA <= startB || endB <= startA);
}

export function isRoomAvailable({
  room,
  availability,
  unavailability,
  bookings,
  eventDate,
  startTimeStr,
}) {
  const weekday = eventDate.getDay(); // 0-6
  const eventStart = timeToMinutes(startTimeStr);
  const duration = room.duration_minutes || 0;
  const buffer = room.buffer_minutes || 0;
  const eventEnd = eventStart + duration + buffer;

  const roomAvailability = availability.filter(
    (a) => a.room_id === room.id && a.weekday === weekday
  );
  const roomUnavailability = unavailability.filter(
    (u) => u.room_id === room.id
  );
  const roomBookings = bookings.filter((b) => b.room_id === room.id);

  // 1) turi tilpti į kažkurį availability langą
  const inAvailability = roomAvailability.some((a) => {
    const aStart = timeToMinutes(a.start_time);
    const aEnd = timeToMinutes(a.end_time);
    return aStart <= eventStart && aEnd >= eventEnd;
  });
  if (!inAvailability) return false;

  // 2) neturi persidengti su unavailability
  const blockedByUnavailability = roomUnavailability.some((u) => {
    const uStart = timeToMinutes(u.start_time);
    const uEnd = timeToMinutes(u.end_time);
    return isOverlap(eventStart, eventEnd, uStart, uEnd);
  });
  if (blockedByUnavailability) return false;

  // 3) neturi persidengti su bookingais
  const hasBookingConflict = roomBookings.some((b) => {
    // čia vėliau galima filtrą: if (b.status === 'cancelled') skip
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    return isOverlap(eventStart, eventEnd, bStart, bEnd);
  });
  if (hasBookingConflict) return false;

  return true;
}
