// app/rezervacija/page.js
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default function ReservationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const time = searchParams.get("time"); // HH:MM
  const durationMinutes = Number(searchParams.get("duration") || "0");

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
    if (!roomId || !date || !time) {
      router.replace("/");
    }
  }, [roomId, date, time, router]);

  // užkraunam kambario + venue + esamą vartotojo telefoną
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

        // user phone iš users lentelės
        const { data: userRow } = await supabase
          .from("users")
          .select("phone")
          .eq("id", user.id)
          .single();

        if (userRow?.phone) setPhone(userRow.phone);

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
      } catch (e) {
        console.error("load reservation page error:", e);
        setError("Nepavyko užkrauti kambario informacijos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!roomId || !date || !time) return;

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("auth error:", userError);
        throw userError;
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      // 1) užtikrinam, kad yra eilutė public.users lentelėje
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
        // jei labai nori, gali čia mest klaidą ir nestatyti booking'o
        // throw upsertError;
      }

      const startMinutes = parseTimeToMinutes(time);
      const endMinutes = startMinutes + durationMinutes;
      const endTime = minutesToTimeStr(endMinutes);

      const { data, error: insertError } = await supabase
        .from("bookings")
        .insert({
          room_id: roomId,
          user_id: user.id,
          event_date: date,
          start_time: time,
          end_time: endTime,
          num_children: numChildren ? Number(numChildren) : null,
          num_adults: numAdults ? Number(numAdults) : null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("booking insert error:", insertError);
        setError(
          insertError.message ||
            insertError.details ||
            JSON.stringify(insertError, null, 2)
        );
        return;
      }

      router.push("/account");
    } catch (e) {
      console.error("handleSubmit error:", e);
      if (!error) {
        setError("Nepavyko išsaugoti rezervacijos. Bandykite dar kartą.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const endTimeLabel =
    time && durationMinutes
      ? minutesToTimeStr(parseTimeToMinutes(time) + durationMinutes)
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 ui-font">
        Rezervacijos patvirtinimas
      </h1>

      {error && (
        <p className="ui-font text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {room && (
        <section className="rounded-2xl bg-slate-50 px-4 py-3 space-y-1">
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
          {room.price != null && (
            <p className="ui-font text-xs text-slate-600">
              Kambario kaina (bazė):{" "}
              <span className="font-semibold">{room.price} €</span>
            </p>
          )}
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
