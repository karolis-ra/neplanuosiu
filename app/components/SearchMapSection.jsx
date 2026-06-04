"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Map } from "lucide-react";

const GameRoomsMap = dynamic(() => import("./GameRoomsMap"), {
  ssr: false,
});

export default function SearchMapSection({ rooms, selectedCity }) {
  const [showMap, setShowMap] = useState(false);

  if (!rooms || rooms.length === 0) return null;

  return (
    <div className="mt-4 flex justify-start">
      <button
        type="button"
        onClick={() => setShowMap(true)}
        className="ui-font inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-primary/30 hover:text-primary"
      >
        <Map size={18} strokeWidth={2.2} />
        Rodyti žemėlapį
      </button>

      {showMap && (
        <GameRoomsMap
          rooms={rooms}
          selectedCity={selectedCity}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
