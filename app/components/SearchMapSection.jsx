// app/components/search/SearchMapSection.jsx
"use client";

import { useState } from "react";
import GameRoomsLeafletMap from "./GameRoomsLeafletMap";

export default function SearchMapSection({ rooms, selectedCity }) {
  const [showMap, setShowMap] = useState(true);

  if (!rooms || rooms.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="ui-font mb-3 rounded-full border border-slate-300 px-4 py-1 text-xs text-slate-700 hover:bg-slate-50"
      >
        {showMap ? "Slėpti žemėlapį" : "Rodyti žemėlapį"}
      </button>

      {showMap && (
        <GameRoomsLeafletMap rooms={rooms} selectedCity={selectedCity} />
      )}
    </div>
  );
}
