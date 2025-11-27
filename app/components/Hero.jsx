"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

export default function Hero() {
  const router = useRouter();
  const [miestas, setMiestas] = useState("");
  const [data, setData] = useState("");
  const [laikas, setLaikas] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    const params = new URLSearchParams();
    if (miestas) params.set("miestas", miestas);
    if (data) params.set("data", data);
    if (laikas) params.set("laikas", laikas);

    router.push(`/paieska?${params.toString()}`);
  }

  return (
    <section className="relative h-[70vh] min-h-[480px] w-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/hero_kid.jpg')" }} // įkelk hero-bg.jpg į /public
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 text-white md:flex-row md:items-center md:justify-between">
          {/* Text */}
          <div className="max-w-xl">
            <h1 className="heading text-3xl md:text-5xl font-bold mb-4">
              Suplanuok vaikų gimtadienį{" "}
              <span className="text-secondary"> be streso</span>
            </h1>
            <p className="ui-font text-base md:text-lg text-slate-100">
              Pasirink miestą, datą ir laiką – ir surask laisvus žaidimų
              kambarius.
            </p>
          </div>

          {/* Form */}
          <div className="w-full max-w-md rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur ui-font text-sm text-slate-900">
            <h2 className="heading text-lg font-semibold mb-3 text-dark">
              Rask laisvą žaidimų kambarį
            </h2>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              {/* Miestas */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">
                  Miestas
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={miestas}
                  onChange={(e) => setMiestas(e.target.value)}
                  required
                >
                  <option value="">Pasirink miestą</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">
                  Šventės data
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>

              {/* Laikas */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">
                  Šventės pradžia
                </label>
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={laikas}
                  onChange={(e) => setLaikas(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-dark"
              >
                Ieškoti žaidimų kambarių
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
