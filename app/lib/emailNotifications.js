import { supabase } from "./supabaseClient";

async function invokeBookingEmail(payload) {
  try {
    const { error } = await supabase.functions.invoke("booking-emails", {
      body: payload,
    });

    if (error) {
      console.warn("booking email notification warning:", error.message);
    }
  } catch (error) {
    console.warn("booking email notification warning:", error);
  }
}

export function notifyBookingCreated(bookingId) {
  if (!bookingId) return Promise.resolve();

  return invokeBookingEmail({
    type: "booking_created",
    bookingId,
  });
}

export function notifyBookingDecision({
  bookingId,
  approvalType,
  serviceId,
  venueId,
  status,
}) {
  if (!bookingId || !status) return Promise.resolve();

  return invokeBookingEmail({
    type: "approval_decided",
    bookingId,
    approvalType,
    serviceId,
    venueId,
    status,
  });
}
