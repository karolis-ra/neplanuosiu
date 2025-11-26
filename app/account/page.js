// app/account/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import RoomCard from "../components/RoomCard";

export default function AccountPage() {
  const [rooms, setRooms] = useState([]);
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

      const { data: favorites, error: favoritesError } = await supabase
        .from("favorite_rooms")
        .select(
          `
          room:rooms (
            *,
            venue:venues (*),
            images (*)
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (favoritesError) {
        console.error("favorites error:", favoritesError.message);
      }

      const fetchedRooms =
        (favorites || []).map((row) => row.room).filter(Boolean) || [];

      setRooms(fetchedRooms);
      setLoading(false);
    };

    loadData();
  }, [router]);

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
          Čia galite matyti pamėgtus kambarius ir ateityje valdyti rezervacijas.
        </p>
      </header>

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
              href="/kambariai"
              className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
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
                venue={room.venue}
                images={room.images || []}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
