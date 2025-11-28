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

      if (!error) setIsFavorite(!!data);
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
        if (!error) {
          setIsFavorite(false);
          onToggle?.(false);
        }
      } else {
        const { error } = await supabase
          .from("favorite_rooms")
          .insert({ user_id: user.id, room_id: roomId });
        if (!error) {
          setIsFavorite(true);
          onToggle?.(true);
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
      className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition
        ${
          isFavorite
            ? "bg-white text-[#513CD6]"
            : "bg-black/25 text-white/80 backdrop-blur border border-white/60"
        }
        ${loading ? "opacity-60 cursor-wait" : "hover:scale-105"}
      `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-8"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M12 21s-6.8-4.3-8-9C3.3 8.3 5.2 6 7.8 6c1.7 0 3.2.9 4.2 2.2C13 6.9 14.5 6 16.2 6c2.6 0 4.5 2.3 3.8 6c-1.2 4.7-8 9-8 9Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
