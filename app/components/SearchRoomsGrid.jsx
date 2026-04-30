"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RoomCard from "./RoomCard";

export default function SearchRoomsGrid({ rooms, hasError }) {
  const [favoriteRoomIds, setFavoriteRoomIds] = useState(null);
  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);

  useEffect(() => {
    let isMounted = true;

    async function loadFavoriteRooms() {
      if (!roomIds.length) {
        setFavoriteRoomIds(new Set());
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!user) {
        setFavoriteRoomIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from("favorite_rooms")
        .select("room_id")
        .eq("user_id", user.id)
        .in("room_id", roomIds);

      if (!isMounted) return;

      if (error) {
        console.error("favorite rooms batch error:", error.message);
        setFavoriteRoomIds(new Set());
        return;
      }

      setFavoriteRoomIds(new Set((data || []).map((item) => item.room_id)));
    }

    loadFavoriteRooms();

    return () => {
      isMounted = false;
    };
  }, [roomIds]);

  return (
    <section className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rooms.length === 0 && !hasError && (
        <div className="ui-font rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm md:col-span-2 lg:col-span-3">
          Neradome kambarių pagal pasirinktus kriterijus.
        </div>
      )}

      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          initialIsFavorite={
            favoriteRoomIds ? favoriteRoomIds.has(room.id) : null
          }
        />
      ))}
    </section>
  );
}
