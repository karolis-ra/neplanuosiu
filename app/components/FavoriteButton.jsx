"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function FavoriteButton({ roomId, onToggle }) {
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const loadInitial = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("favorite_rooms")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("room_id", roomId)
        .maybeSingle();

      if (error) {
        console.error("favorite check error:", error.message);
        return;
      }

      setIsFavorite(!!data);
    };

    loadInitial();
  }, [roomId]);

  const handleClick = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (isFavorite) {
        const { error } = await supabase
          .from("favorite_rooms")
          .delete()
          .eq("user_id", user.id)
          .eq("room_id", roomId);

        if (error) {
          console.error("remove favorite error:", error.message);
        } else {
          setIsFavorite(false);
          if (onToggle) onToggle(false); // 👈 pranešam, kad NEBE favoritas
        }
      } else {
        const { error } = await supabase
          .from("favorite_rooms")
          .insert({ user_id: user.id, room_id: roomId });

        if (error) {
          console.error("add favorite error:", error.message);
        } else {
          setIsFavorite(true);
          if (onToggle) onToggle(true); // 👈 pranešam, kad tapo favoritu
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-sm transition
        ${
          isFavorite
            ? "border-transparent bg-white text-red-500"
            : "border-white/70 bg-black/25 text-white/80 backdrop-blur"
        }
        ${loading ? "opacity-60 cursor-wait" : "hover:scale-105"}
      `}
      aria-label={isFavorite ? "Pašalinti iš mėgstamų" : "Pridėti į mėgstamus"}
    >
      {/* Heart icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 20.25s-5.25-3.15-7.5-6.15C3.24 12.79 3 11.96 3 11.1 3 9 4.48 7.5 6.5 7.5c1.19 0 2.34.59 3.02 1.54L12 10.9l2.48-1.86A3.77 3.77 0 0 1 17.5 7.5C19.52 7.5 21 9 21 11.1c0 .86-.24 1.69-1.5 2.99-2.25 3-7.5 6.16-7.5 6.16Z"
        />
      </svg>
    </button>
  );
}
