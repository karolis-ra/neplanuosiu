"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FavoriteButton from "./FavoriteButton";
import ResponsiveImageFrame from "./ResponsiveImageFrame";
import { supabase } from "../lib/supabaseClient";

export default function RoomCard({ room, initialIsFavorite, onFavoriteChange }) {
  const primaryImageUrl = room.primaryImageUrl;
  const city = room.venue_city || room.city || "";
  const address = room.venue_address || "";
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;
      setUserRole(userRow?.role || "");
    }

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = (isFavorite) => {
    if (onFavoriteChange) {
      onFavoriteChange(room.id, isFavorite);
    }
  };

  const ctaLabel = userRole === "venue_owner" ? "Perziureti" : "Rezervuoti";

  return (
    <article className="relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="relative bg-slate-200">
        <FavoriteButton
          roomId={room.id}
          initialIsFavorite={initialIsFavorite}
          onToggle={handleToggle}
        />

        <Link
          href={`/kambariai/${room.id}`}
          className="block w-full"
          aria-label={`Atverti ${room.name} puslapi`}
        >
          <ResponsiveImageFrame
            src={primaryImageUrl}
            alt={room.name}
            ratio="4 / 3"
            className="rounded-t-[24px]"
            placeholder="Nuotrauka netrukus"
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="ui-font line-clamp-2 text-base font-semibold text-slate-900">
            {room.name}
          </h3>

          {room.price != null && (
            <div className="ui-font text-right text-sm font-semibold text-primary">
              {room.price} € / val.
            </div>
          )}
        </div>

        {room.venue_name && (
          <p className="ui-font line-clamp-1 text-xs text-slate-500">
            {room.venue_name}
          </p>
        )}

        {(city || address) && (
          <p className="ui-font line-clamp-1 text-xs text-slate-500">
            {address && <span>{address}</span>}
            {address && city && <span>, </span>}
            {city && <span>{city}</span>}
          </p>
        )}

        {room.description && (
          <p className="ui-font mt-1 line-clamp-2 text-xs text-slate-600">
            {room.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {room.capacity && (
            <span className="ui-font text-xs text-slate-500">
              Iki {room.capacity} vaiku
            </span>
          )}

          <Link
            href={`/kambariai/${room.id}`}
            className="ui-font inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
