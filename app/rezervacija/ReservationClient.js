"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function parseTimeToMinutes(timeStr) {
  const normalized = String(timeStr).slice(0, 5);
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function ReservationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const durationMinutes = Number(searchParams.get("duration") || "0");

  const baseDurationMinutes = Number(
    searchParams.get("baseDurationMinutes") || "0",
  );
  const extraHours = Number(searchParams.get("extraHours") || "0");
  const extraMinutes = Number(searchParams.get("extraMinutes") || "0");
  const basePrice = Number(searchParams.get("basePrice") || "0");
  const extraHourPrice = Number(searchParams.get("extraHourPrice") || "0");

  const roomTotal = Number(searchParams.get("roomTotal") || "0");
  const servicesTotal = Number(searchParams.get("servicesTotal") || "0");
  const grandTotal = Number(
    searchParams.get("grandTotal") || roomTotal + servicesTotal,
  );

  const selectedServiceIds = useMemo(
    () =>
      [
        searchParams.get("decorationsId"),
        searchParams.get("animatorId"),
        searchParams.get("cakeId"),
      ].filter(Boolean),
    [searchParams],
  );

  const [room, setRoom] = useState(null);
  const [venue, setVenue] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [numChildren, setNumChildren] = useState("");
  const [numAdults, setNumAdults] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId || !date || !time) {
      router.replace("/");
    }
  }, [roomId, date, time, router]);

  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        setIsLoggedIn(Boolean(user));

        if (user) {
          setGuestEmail(user.email || "");
          setGuestName(user.user_metadata?.full_name || "");

          const { data: userRow } = await supabase
            .from("users")
            .select("phone, full_name")
            .eq("id", user.id)
            .single();

          if (userRow?.phone) setPhone(userRow.phone);
          if (userRow?.full_name && !user.user_metadata?.full_name) {
            setGuestName(userRow.full_name);
          }
        }

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("id, name, price, venue_id, city")
          .eq("id", roomId)
          .single();

        if (roomError) throw roomError;
        setRoom(roomData);

        if (roomData.venue_id) {
          const { data: venueData } = await supabase
            .from("venues")
            .select("id, name, address, city, phone, email")
            .eq("id", roomData.venue_id)
            .single();
          setVenue(venueData || null);
        }

        if (selectedServiceIds.length > 0) {
          const { data: serviceRows, error: servicesError } = await supabase
            .from("services")
            .select("id, name, service_type, price_per_unit, units_of_measure")
            .in("id", selectedServiceIds);

          if (servicesError) throw servicesError;
          setSelectedServices(serviceRows || []);
        } else {
          setSelectedServices([]);
        }
      } catch (e) {
        console.error("load reservation page error:", e);
        setError("Nepavyko užkrauti rezervacijos informacijos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, selectedServiceIds]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!roomId || !date || !time) return;

    if (!guestName.trim()) {
      setError("Įveskite vardą ir pavardę.");
      return;
    }

    if (!guestEmail.trim()) {
      setError("Įveskite el. paštą.");
      return;
    }

    if (!phone.trim()) {
      setError("Įveskite telefono numerį.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (user) {
        const userRow = {
          id: user.id,
          email: user.email || guestEmail || null,
          full_name: guestName || user.user_metadata?.full_name || null,
          phone: phone || null,
        };

        const { error: upsertError } = await supabase
          .from("users")
          .upsert(userRow, { onConflict: "id" });

        if (upsertError) {
          console.error("users upsert error:", upsertError);
        }
      }

      const startMinutes = parseTimeToMinutes(time);
      const endMinutes = startMinutes + durationMinutes;
      const endTime = minutesToTimeStr(endMinutes);

      const bookingPayload = {
        room_id: roomId,
        user_id: user?.id || null,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: phone,
        event_date: date,
        start_time: time,
        end_time: endTime,
        num_children: numChildren ? Number(numChildren) : null,
        num_adults: numAdults ? Number(numAdults) : null,
        note: note || null,
        base_price: basePrice || null,
        extra_hours: extraHours || 0,
        extra_hour_price: extraHourPrice || 0,
        services_total: servicesTotal || 0,
        total_price: grandTotal || 0,
        total_amount: grandTotal || 0,
        base_duration_minutes: baseDurationMinutes || null,
        extra_minutes: extraMinutes || 0,
        booking_source: "web",
      };

      const { data: insertedBooking, error: insertError } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select("id")
        .single();

      if (insertError) {
        console.error("booking insert error:", insertError);
        setError(
          insertError.message ||
            insertError.details ||
            JSON.stringify(insertError, null, 2),
        );
        return;
      }

      if (selectedServices.length > 0) {
        const bookingServicesPayload = selectedServices.map((item) => ({
          booking_id: insertedBooking.id,
          service_id: item.id,
          quantity: 1,
          price_per_unit: item.price_per_unit || 0,
          units_of_measure: item.units_of_measure || "unit",
          start_time: time,
          end_time: endTime,
        }));

        const { error: bookingServicesError } = await supabase
          .from("booking_services")
          .insert(bookingServicesPayload);

        if (bookingServicesError) {
          console.error("booking services insert error:", bookingServicesError);
          setError("Nepavyko išsaugoti pasirinktų paslaugų.");
          return;
        }
      }

      if (user) {
        router.push("/account");
        return;
      }

      router.push("/");
    } catch (e) {
      console.error("handleSubmit error:", e);
      setError("Nepavyko išsaugoti rezervacijos. Bandykite dar kartą.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[1100px] px-[16px] py-[40px]">
        <p className="ui-font text-[14px] text-slate-500">Kraunama...</p>
      </main>
    );
  }

  const endTimeLabel =
    time && durationMinutes
      ? minutesToTimeStr(parseTimeToMinutes(time) + durationMinutes)
      : null;

  return (
    <main className="mx-auto max-w-[1100px] px-[16px] py-[32px]">
      <div className="grid gap-[24px] lg:grid-cols-[1.2fr,0.8fr]">
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="mb-[20px] space-y-[8px]">
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Rezervacijos patvirtinimas
            </p>
            <h1 className="ui-font text-[28px] font-semibold text-slate-900">
              Užbaikite rezervaciją
            </h1>
            <p className="ui-font text-[14px] leading-[22px] text-slate-600">
              {isLoggedIn
                ? "Patikrinkite informaciją ir patvirtinkite rezervaciją."
                : "Rezervaciją galite pateikti ir be paskyros. Įveskite kontaktinius duomenis ir patvirtinkite užsakymą."}
            </p>
          </div>

          {error && (
            <p className="ui-font mb-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px] text-[14px] text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-[16px]">
            <div className="grid gap-[12px] md:grid-cols-2">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Vardas, pavardė
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="Įveskite vardą ir pavardę"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  El. paštas
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="vardas@email.com"
                />
              </div>
            </div>

            <div className="grid gap-[12px] md:grid-cols-2">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Telefono numeris
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="+370..."
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Vaikų / suaugusių skaičius
                </label>
                <div className="grid grid-cols-2 gap-[10px]">
                  <input
                    type="number"
                    min="0"
                    value={numChildren}
                    onChange={(e) => setNumChildren(e.target.value)}
                    className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                    placeholder="Vaikai"
                  />
                  <input
                    type="number"
                    min="0"
                    value={numAdults}
                    onChange={(e) => setNumAdults(e.target.value)}
                    className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                    placeholder="Suaugę"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Papildoma informacija / pageidavimai
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
                placeholder="Pvz.: vaikų amžius, alergijos, specialūs prašymai..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Saugoma..." : "Patvirtinti rezervaciją"}
            </button>
          </form>
        </section>

        <aside className="space-y-[16px]">
          <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
            <h2 className="ui-font text-[20px] font-semibold text-slate-900">
              Rezervacijos suvestinė
            </h2>

            <div className="mt-[16px] space-y-[12px]">
              <div>
                <p className="ui-font text-[16px] font-semibold text-slate-900">
                  {room?.name}
                </p>
                {venue && (
                  <p className="ui-font mt-[4px] text-[13px] text-slate-500">
                    {venue.name}
                    {venue.address ? ` • ${venue.address}` : ""}
                    {venue.city ? `, ${venue.city}` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-[8px] rounded-[20px] bg-slate-50 p-[16px]">
                <div className="flex items-start justify-between gap-[10px]">
                  <span className="ui-font text-[13px] text-slate-500">
                    Data
                  </span>
                  <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                    {date}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-[10px]">
                  <span className="ui-font text-[13px] text-slate-500">
                    Laikas
                  </span>
                  <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                    {time}
                    {endTimeLabel ? ` - ${endTimeLabel}` : ""}
                  </span>
                </div>
              </div>

              <div className="space-y-[10px]">
                <div className="flex items-start justify-between gap-[10px]">
                  <span className="ui-font text-[14px] text-slate-600">
                    Kambarys
                  </span>
                  <span className="ui-font text-[14px] font-semibold text-slate-900">
                    {formatPrice(roomTotal)}
                  </span>
                </div>

                {selectedServices.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-[10px]"
                  >
                    <span className="ui-font text-[14px] text-slate-600">
                      {item.name}
                    </span>
                    <span className="ui-font text-[14px] font-semibold text-slate-900">
                      {formatPrice(item.price_per_unit)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-[14px]">
                <div className="flex items-center justify-between gap-[10px]">
                  <span className="ui-font text-[14px] text-slate-500">
                    Iš viso
                  </span>
                  <span className="ui-font text-[28px] font-semibold text-primary">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {!isLoggedIn && (
            <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-[18px]">
              <p className="ui-font text-[14px] leading-[22px] text-slate-600">
                Norėsite lengviau sekti rezervacijas ateityje? Po užsakymo
                galėsite susikurti paskyrą.
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
