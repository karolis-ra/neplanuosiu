// app/account/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { buildRoomsWithImages } from "../lib/roomImageUtils";
import RoomCard from "../components/RoomCard";

function canCancelBooking(booking) {
  if (!booking.event_date || !booking.start_time) return false;
  // start_time iš Supabase ateis pvz. "14:00:00"
  const [h, m] = booking.start_time.split(":").map(Number);
  const eventDate = new Date(booking.event_date);
  eventDate.setHours(h || 0, m || 0, 0, 0);
  const diffMs = eventDate.getTime() - Date.now();
  const hours = diffMs / (1000 * 60 * 60);
  return hours >= 48;
}

export default function AccountPage() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("auth error:", userError.message);
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      try {
        setLoading(true);

        // FAVORITES
        const { data: favorites, error: favoritesError } = await supabase
          .from("favorite_rooms")
          .select("room_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (favoritesError) {
          console.error("favorites error:", favoritesError.message);
        }

        const roomIds = (favorites || []).map((f) => f.room_id);

        if (roomIds.length > 0) {
          const { data: roomsData, error: roomsError } = await supabase
            .from("rooms")
            .select(
              "id, venue_id, name, description, price, capacity, city, is_listed"
            )
            .in("id", roomIds)
            .eq("is_listed", true);

          if (roomsError) {
            console.error("rooms error:", roomsError.message);
          } else {
            const roomsWithImages =
              (await buildRoomsWithImages({
                supabase,
                rooms: roomsData || [],
              })) || [];
            setRooms(roomsWithImages);
          }
        } else {
          setRooms([]);
        }

        // BOOKINGS
        const { data: bookingsData, error: bookingsError } = await supabase
          .from("bookings")
          .select(
            `
            id,
            room_id,
            event_date,
            start_time,
            end_time,
            created_at,
            num_children,
            num_adults,
            room:rooms (
              id,
              name,
              city,
              venue:venues (
                name,
                address,
                city
              )
            )
          `
          )
          .eq("user_id", user.id)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (bookingsError) {
          console.error("bookings error:", bookingsError.message);
        } else {
          setBookings(bookingsData || []);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleFavoriteChange = (roomId, isFavorite) => {
    if (!isFavorite) {
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    if (!canCancelBooking(booking)) {
      alert(
        "Šios rezervacijos atšaukti nebegalima, nes liko mažiau nei 48 valandos iki šventės pradžios."
      );
      return;
    }

    const ok = confirm("Ar tikrai norite atšaukti šią rezervaciją?");
    if (!ok) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      console.error("cancel booking error:", error.message);
      alert("Nepavyko atšaukti rezervacijos. Bandykite dar kartą.");
      return;
    }

    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-500">Kraunama paskyra...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 ui-font">
          Mano paskyra
        </h1>
        <p className="text-sm text-slate-600">
          Čia galite matyti pamėgtus kambarius ir valdyti savo rezervacijas.
        </p>
      </header>

      {/* Pamėgti kambariai */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold ui-font">Pamėgti kambariai</h2>
          <span className="text-sm text-slate-500">
            Iš viso: {rooms.length}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-base font-medium text-slate-800 ui-font">
              Neturite pamėgtų kambarių
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Naršykite kambarius ir spauskite ant širdelės, kad juos
              išsaugotumėte.
            </p>

            <a
              href="/paieska"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
            >
              Peržiūrėti kambarius
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onFavoriteChange={handleFavoriteChange}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mano rezervacijos */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold ui-font">Mano rezervacijos</h2>
          <span className="text-sm text-slate-500">
            Iš viso: {bookings.length}
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-600 ui-font">
              Šiuo metu neturite aktyvių rezervacijų.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const canCancel = canCancelBooking(b);
              const eventDate = b.event_date;
              const startTime = b.start_time?.slice(0, 5) || "";
              const endTime = b.end_time?.slice(0, 5) || "";
              const room = b.room || {};
              const venue = room.venue || {};

              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="ui-font font-semibold text-slate-800">
                      {room.name || "Kambarys"}
                    </p>
                    <p className="ui-font text-xs text-slate-600">
                      {eventDate} {startTime}
                      {endTime && `–${endTime}`}
                    </p>
                    <p className="ui-font text-xs text-slate-500">
                      {venue.name && <span>{venue.name}</span>}
                      {venue.address && (
                        <span>
                          {venue.name ? " • " : ""}
                          {venue.address}
                        </span>
                      )}
                      {venue.city && (
                        <span>
                          {venue.name || venue.address ? ", " : ""}
                          {venue.city}
                        </span>
                      )}
                    </p>
                    {(b.num_children || b.num_adults) && (
                      <p className="ui-font text-[11px] text-slate-500">
                        Vaikai: {b.num_children || 0} • Suaugę:{" "}
                        {b.num_adults || 0}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2 md:mt-0 md:flex-col md:items-end">
                    <button
                      type="button"
                      onClick={() => handleCancelBooking(b.id)}
                      disabled={!canCancel}
                      className="ui-font inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition
                        disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300
                        border-red-300 text-red-600 hover:border-red-500 hover:text-red-700"
                    >
                      Atšaukti rezervaciją
                    </button>
                    {!canCancel && (
                      <span className="ui-font text-[10px] text-slate-400">
                        Atšaukimas galimas tik likus ≥ 48 val.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
