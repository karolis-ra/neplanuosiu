"use client";

import { useState, useRef, useEffect } from "react";

const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

export default function CityField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const hasValue = Boolean(value);

  const baseClasses =
    "w-full h-[40px] flex items-center rounded-full border bg-white/95 px-4 pr-10 text-left text-sm shadow-sm " +
    "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30";

  const stateClasses =
    hasValue || open
      ? "border-primary text-slate-900"
      : "border-slate-200 text-slate-400";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700">Miestas</label>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${baseClasses} ${stateClasses}`}
        >
          {value || "Pasirink miestą"}

          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {open && (
          <div className="absolute left-0 mt-2 w-full rounded-2xl border border-slate-100 bg-white shadow-lg overflow-hidden z-50">
            {cities.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
