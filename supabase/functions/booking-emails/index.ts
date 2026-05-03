import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const mailFrom =
  Deno.env.get("MAIL_FROM") || "Neplanuosiu <noreply@neplanuosiu.lt>";
const appUrl = (Deno.env.get("APP_URL") || "http://localhost:3000").replace(
  /\/$/,
  "",
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function escapeHtml(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTimeRange(startTime?: string, endTime?: string) {
  const start = String(startTime || "").slice(0, 5);
  const end = String(endTime || "").slice(0, 5);
  return end ? `${start} - ${end}` : start || "-";
}

function statusLabel(status?: string) {
  switch (status) {
    case "confirmed":
      return "patvirtinta";
    case "rejected":
      return "atmesta";
    case "cancelled":
      return "atšaukta";
    default:
      return "atnaujinta";
  }
}

function serviceTypeLabel(type?: string) {
  switch (type) {
    case "decorations":
      return "Dekoracijos";
    case "animator":
      return "Animatorius";
    case "cake":
      return "Tortas";
    default:
      return "Paslauga";
  }
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is missing; email skipped", { to, subject });
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider error: ${response.status} ${body}`);
  }

  return response.json();
}

async function getBooking(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      reservation_code,
      guest_name,
      guest_email,
      event_date,
      start_time,
      end_time,
      total_amount,
      total_price,
      room:rooms (
        id,
        name,
        venue_id,
        venue:venues (
          id,
          name,
          email,
          owner_id,
          address,
          city
        )
      ),
      booking_services (
        service_id,
        service:services (
          id,
          name,
          service_type,
          provider_id,
          provider:service_providers (
            id,
            name,
            email,
            owner_id
          )
        )
      )
    `,
    )
    .eq("id", bookingId)
    .single();

  if (error) throw error;
  return data;
}

async function getOwnerEmails(ownerIds: string[]) {
  if (!ownerIds.length) return new Map<string, string>();

  const { data, error } = await supabase
    .from("users")
    .select("id, email")
    .in("id", ownerIds);

  if (error) throw error;

  return new Map(
    (data || [])
      .filter((item) => item.id && item.email)
      .map((item) => [item.id, item.email]),
  );
}

function bookingSummaryRows(booking: any) {
  return `
    <p><strong>Rezervacijos Nr.:</strong> ${escapeHtml(
      booking.reservation_code || "-",
    )}</p>
    <p><strong>Kambarys:</strong> ${escapeHtml(
      booking.room?.name || "-",
    )}</p>
    <p><strong>Data:</strong> ${escapeHtml(booking.event_date || "-")}</p>
    <p><strong>Laikas:</strong> ${escapeHtml(
      formatTimeRange(booking.start_time, booking.end_time),
    )}</p>
    <p><strong>Klientas:</strong> ${escapeHtml(
      booking.guest_name || "-",
    )}</p>
  `;
}

async function notifyPartnersAboutBooking(bookingId: string) {
  const booking = await getBooking(bookingId);
  const venue = booking.room?.venue;
  const services = booking.booking_services || [];

  const ownerIds = [
    venue?.owner_id,
    ...services.map((item: any) => item.service?.provider?.owner_id),
  ].filter(Boolean);
  const ownerEmails = await getOwnerEmails(Array.from(new Set(ownerIds)));

  const recipients = new Map<string, string>();
  const venueEmail = ownerEmails.get(venue?.owner_id) || venue?.email;

  if (venueEmail) {
    recipients.set(venueEmail, venue?.name || "Žaidimų erdvė");
  }

  services.forEach((item: any) => {
    const provider = item.service?.provider;
    const email = ownerEmails.get(provider?.owner_id) || provider?.email;
    if (email) {
      recipients.set(email, provider?.name || "Paslaugos teikėjas");
    }
  });

  const link = `${appUrl}/partner/rezervacijos`;
  const subject = `Nauja rezervacijos užklausa ${booking.reservation_code || ""}`.trim();
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <h2>Nauja rezervacijos užklausa</h2>
      <p>Gavote naują užklausą, kurią reikia peržiūrėti ir patvirtinti arba atmesti.</p>
      ${bookingSummaryRows(booking)}
      <p>
        <a href="${link}" style="display:inline-block;background:#432c69;color:#fff;text-decoration:none;padding:12px 18px;border-radius:14px">
          Peržiūrėti rezervacijas
        </a>
      </p>
    </div>
  `;
  const text = `Gavote naują rezervacijos užklausą (${booking.reservation_code || "-"}). Peržiūrėkite ją: ${link}`;

  const results = [];
  for (const [email] of recipients) {
    results.push(await sendEmail({ to: email, subject, html, text }));
  }

  return { sent: results.length };
}

async function notifyClientAboutDecision({
  bookingId,
  approvalType,
  serviceId,
  status,
}: {
  bookingId: string;
  approvalType?: string;
  serviceId?: string;
  status?: string;
}) {
  const booking = await getBooking(bookingId);
  const to = booking.guest_email;

  if (!to) {
    return { sent: 0, skipped: "missing_guest_email" };
  }

  const service = (booking.booking_services || []).find(
    (item: any) => item.service_id === serviceId,
  )?.service;

  const itemName =
    approvalType === "service"
      ? `${serviceTypeLabel(service?.service_type)}: ${service?.name || "paslauga"}`
      : `Kambarys: ${booking.room?.name || "kambarys"}`;
  const label = statusLabel(status);
  const link = `${appUrl}/account#rezervacijos`;
  const subject = `Rezervacijos būsena ${label}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <h2>Rezervacijos būsena ${escapeHtml(label)}</h2>
      <p>Atnaujinta jūsų rezervacijos dalis: <strong>${escapeHtml(itemName)}</strong>.</p>
      ${bookingSummaryRows(booking)}
      <p>Visą rezervacijos informaciją galite stebėti savo profilio puslapyje.</p>
      <p>
        <a href="${link}" style="display:inline-block;background:#432c69;color:#fff;text-decoration:none;padding:12px 18px;border-radius:14px">
          Peržiūrėti rezervaciją
        </a>
      </p>
    </div>
  `;
  const text = `Jūsų rezervacijos dalis "${itemName}" yra ${label}. Rezervaciją galite stebėti profilyje: ${link}`;

  await sendEmail({ to, subject, html, text });
  return { sent: 1 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    if (payload.type === "booking_created") {
      const result = await notifyPartnersAboutBooking(payload.bookingId);
      return Response.json({ ok: true, ...result }, { headers: corsHeaders });
    }

    if (payload.type === "approval_decided") {
      const result = await notifyClientAboutDecision(payload);
      return Response.json({ ok: true, ...result }, { headers: corsHeaders });
    }

    return Response.json(
      { ok: false, error: "Unknown email notification type" },
      { status: 400, headers: corsHeaders },
    );
  } catch (error) {
    console.error("booking email function error:", error);
    const message =
      error instanceof Error ? error.message : "Email notification failed";

    return Response.json(
      { ok: false, error: message },
      { status: 500, headers: corsHeaders },
    );
  }
});
