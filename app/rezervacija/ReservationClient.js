"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default function ReservationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");

  const durationMinutes = Number(searchParams.get("duration") || "0");
  const extraHours = Number(searchParams.get("extraHours") || "0");
  const extraMinutes = Number(searchParams.get("extraMinutes") || "0");
  const basePriceFromQuery = Number(searchParams.get("basePrice") || "0");
  const extraHourPriceFromQuery = Number(
    searchParams.get("extraHourPrice") || "0",
  );

  const [room, setRoom] = useState(null);
  const [venue, setVenue] = useState(null);
  const [numChildren, setNumChildren] = useState("");
  const [numAdults, setNumAdults] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId || !date || !time || !durationMinutes) {
      router.replace("/");
    }
  }, [roomId, date, time, durationMinutes, router]);

  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/prisijungti");
          return;
        }

        const { data: userRow } = await supabase
          .from("users")
          .select("phone")
          .eq("id", user.id)
          .single();

        if (userRow?.phone) setPhone(userRow.phone);

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select(
            "id, name, price, venue_id, city, duration_minutes, buffer_minutes, extra_hour_price",
          )
          .eq("id", roomId)
          .single();

        if (roomError) throw roomError;
        setRoom(roomData);

        if (roomData?.venue_id) {
          const { data: venueData } = await supabase
            .from("venues")
            .select("id, name, address, city, phone, email")
            .eq("id", roomData.venue_id)
            .single();

          setVenue(venueData || null);
        }
      } catch (e) {
        console.error("load reservation page error:", e);
        setError("Nepavyko užkrauti kambario informacijos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, router]);

  const pricing = useMemo(() => {
    const basePrice =
      room?.price != null
        ? Number(room.price)
        : Number(basePriceFromQuery || 0);

    const extraHourPrice =
      room?.extra_hour_price != null
        ? Number(room.extra_hour_price)
        : Number(extraHourPriceFromQuery || 0);

    const safeExtraHours = Math.max(0, Math.min(4, Number(extraHours || 0)));
    const safeExtraMinutes = Math.max(
      0,
      Math.min(240, Number(extraMinutes || safeExtraHours * 60)),
    );

    const extraPrice = safeExtraHours * extraHourPrice;
    const totalAmount = basePrice + extraPrice;

    return {
      basePrice,
      extraHourPrice,
      safeExtraHours,
      safeExtraMinutes,
      extraPrice,
      totalAmount,
    };
  }, [
    room,
    basePriceFromQuery,
    extraHourPriceFromQuery,
    extraHours,
    extraMinutes,
  ]);

  const startMinutes = time ? parseTimeToMinutes(time) : 0;
  const totalDurationMinutes = durationMinutes + pricing.safeExtraMinutes;
  const endTimeLabel =
    time && totalDurationMinutes
      ? minutesToTimeStr(startMinutes + totalDurationMinutes)
      : null;

  async function validateAvailabilityBeforeInsert() {
    if (!roomId || !date || !time || !room) {
      return { ok: false, message: "Trūksta rezervacijos duomenų." };
    }

    const bookingStart = parseTimeToMinutes(time);
    const bookingEnd =
      bookingStart + durationMinutes + pricing.safeExtraMinutes;
    const occupiedUntil = bookingEnd + Number(room.buffer_minutes || 0);

    const weekday = new Date(date).getDay();

    const [availabilityRes, bookingsRes, blocksRes] = await Promise.all([
      supabase
        .from("availability")
        .select("start_time, end_time")
        .eq("room_id", roomId)
        .eq("weekday", weekday),
      supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("room_id", roomId)
        .eq("event_date", date),
      supabase
        .from("room_unavailability")
        .select("start_time, end_time")
        .eq("room_id", roomId)
        .eq("date", date),
    ]);

    if (availabilityRes.error) {
      return {
        ok: false,
        message: "Nepavyko patikrinti kambario darbo laiko.",
      };
    }

    if (bookingsRes.error) {
      return {
        ok: false,
        message: "Nepavyko patikrinti kitų rezervacijų. Bandykite dar kartą.",
      };
    }

    if (blocksRes.error) {
      return {
        ok: false,
        message: "Nepavyko patikrinti kambario užimtumo. Bandykite dar kartą.",
      };
    }

    const availabilityRows = availabilityRes.data || [];
    const bookings = (bookingsRes.data || []).filter((b) => {
      if (!b.status) return true;
      return b.status !== "cancelled";
    });
    const blocks = blocksRes.data || [];

    const fitsInAvailability = availabilityRows.some((a) => {
      const aStart = parseTimeToMinutes(a.start_time);
      const aEnd = parseTimeToMinutes(a.end_time);
      return aStart <= bookingStart && aEnd >= occupiedUntil;
    });

    if (!fitsInAvailability) {
      return {
        ok: false,
        message:
          "Pasirinktas laikas nebetelpa į kambario darbo laiką su papildomu laiku ir paruošimo tarpu.",
      };
    }

    const overlapsBooking = bookings.some((b) => {
      const bStart = parseTimeToMinutes(b.start_time);
      const bEnd = parseTimeToMinutes(b.end_time);
      return rangesOverlap(bookingStart, occupiedUntil, bStart, bEnd);
    });

    if (overlapsBooking) {
      return {
        ok: false,
        message:
          "Šis laikas ką tik tapo nebegalimas, nes kertasi su kita rezervacija.",
      };
    }

    const overlapsBlock = blocks.some((b) => {
      const bStart = parseTimeToMinutes(b.start_time);
      const bEnd = parseTimeToMinutes(b.end_time);
      return rangesOverlap(bookingStart, occupiedUntil, bStart, bEnd);
    });

    if (overlapsBlock) {
      return {
        ok: false,
        message: "Šis laikas nebegalimas dėl kambario užimtumo.",
      };
    }

    return { ok: true };
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!roomId || !date || !time || !room) return;

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      const userRow = {
        id: user.id,
        email: user.email || null,
        full_name: user.user_metadata?.full_name || null,
        phone: phone || null,
      };

      const { error: upsertError } = await supabase
        .from("users")
        .upsert(userRow, { onConflict: "id" });

      if (upsertError) {
        console.error("users upsert error:", upsertError);
      }

      const validation = await validateAvailabilityBeforeInsert();

      if (!validation.ok) {
        setError(validation.message);
        return;
      }

      const bookingEndMinutes =
        parseTimeToMinutes(time) + durationMinutes + pricing.safeExtraMinutes;
      const endTime = minutesToTimeStr(bookingEndMinutes);

      const insertPayload = {
        room_id: roomId,
        user_id: user.id,
        event_date: date,
        start_time: time,
        end_time: endTime,
        num_children: numChildren ? Number(numChildren) : null,
        num_adults: numAdults ? Number(numAdults) : null,
        base_duration_minutes: durationMinutes,
        extra_hours: pricing.safeExtraHours,
        extra_minutes: pricing.safeExtraMinutes,
        base_price: pricing.basePrice,
        extra_hour_price: pricing.extraHourPrice,
        total_price: pricing.totalAmount,
        total_amount: pricing.totalAmount,
      };

      const { error: insertError } = await supabase
        .from("bookings")
        .insert(insertPayload);

      if (insertError) {
        console.error("booking insert error:", insertError);
        setError(
          insertError.message ||
            insertError.details ||
            JSON.stringify(insertError, null, 2),
        );
        return;
      }

      router.push("/account");
    } catch (e) {
      console.error("handleSubmit error:", e);
      setError("Nepavyko išsaugoti rezervacijos. Bandykite dar kartą.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-500 ui-font">Kraunama...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 ui-font">
        Rezervacijos patvirtinimas
      </h1>

      {error && (
        <p className="ui-font rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {room && (
        <section className="space-y-1 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="ui-font text-sm font-semibold text-slate-800">
            {room.name}
          </p>

          {venue && (
            <p className="ui-font text-xs text-slate-600">
              {venue.name}
              {venue.address && ` • ${venue.address}`}
              {venue.city && `, ${venue.city}`}
            </p>
          )}

          <p className="ui-font text-xs text-slate-600">
            Data:{" "}
            <span className="font-semibold">
              {date} {time}
              {endTimeLabel && `–${endTimeLabel}`}
            </span>
          </p>

          <p className="ui-font text-xs text-slate-600">
            Bazinė trukmė:{" "}
            <span className="font-semibold">{durationMinutes} min</span>
          </p>

          {pricing.safeExtraHours > 0 && (
            <p className="ui-font text-xs text-slate-600">
              Papildomas laikas:{" "}
              <span className="font-semibold">
                {pricing.safeExtraHours} val. ({pricing.safeExtraMinutes} min)
              </span>
            </p>
          )}

          {pricing.basePrice > 0 && (
            <p className="ui-font text-xs text-slate-600">
              Kambario kaina:{" "}
              <span className="font-semibold">{pricing.basePrice} €</span>
            </p>
          )}

          {pricing.safeExtraHours > 0 && (
            <>
              <p className="ui-font text-xs text-slate-600">
                Papildomos valandos tarifas:{" "}
                <span className="font-semibold">
                  {pricing.extraHourPrice} € / val.
                </span>
              </p>
              <p className="ui-font text-xs text-slate-600">
                Papildomo laiko kaina:{" "}
                <span className="font-semibold">{pricing.extraPrice} €</span>
              </p>
            </>
          )}

          <p className="ui-font text-sm text-slate-800">
            Iš viso:{" "}
            <span className="font-semibold">{pricing.totalAmount} €</span>
          </p>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="ui-font text-xs text-slate-600">
              Vaikų skaičius
            </label>
            <input
              type="number"
              min="0"
              value={numChildren}
              onChange={(e) => setNumChildren(e.target.value)}
              className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="ui-font text-xs text-slate-600">
              Suaugusių skaičius
            </label>
            <input
              type="number"
              min="0"
              value={numAdults}
              onChange={(e) => setNumAdults(e.target.value)}
              className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="ui-font text-xs text-slate-600">
            Kontaktinis telefono numeris
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="+370..."
          />
        </div>

        <div className="space-y-1">
          <label className="ui-font text-xs text-slate-600">
            Papildoma informacija / pageidavimai
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Pvz.: vaikų amžius, alergijos, specialūs prašymai..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="ui-font mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saugoma..." : "Patvirtinti rezervaciją"}
        </button>
      </form>
    </main>
  );
}
