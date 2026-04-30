"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SelectControl from "./SelectControl";

const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

export default function SearchFilters({
  initialCity = "",
  initialDate = "",
  initialTime = "",
  initialPeople = "",
}) {
  const router = useRouter();

  const [miestas, setMiestas] = useState(initialCity);
  const [data, setData] = useState(initialDate);
  const [laikas, setLaikas] = useState(initialTime);
  const [zmones, setZmones] = useState(initialPeople);

  function handleSubmit(e) {
    e.preventDefault();

    const params = new URLSearchParams();
    if (miestas) params.set("miestas", miestas);
    if (data) params.set("data", data);
    if (laikas) params.set("laikas", laikas);
    if (zmones) params.set("zmones", zmones);

    router.push(`/paieska?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm md:flex-row md:items-end md:gap-4"
    >
      {/* Miestas */}
      <div className="flex-1">
        <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
          Miestas
        </label>
        <SelectControl
          value={miestas}
          onChange={setMiestas}
          options={[
            { value: "", label: "Visi miestai" },
            ...CITIES.map((city) => ({
              value: city,
              label: city,
            })),
          ]}
          placeholder="Pasirink miestą"
          buttonClassName="min-h-[40px] rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {/* Data */}
      <div>
        <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
          Šventės data
        </label>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Laikas */}
      <div>
        <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
          Šventės pradžia
        </label>
        <input
          type="time"
          value={laikas}
          onChange={(e) => setLaikas(e.target.value)}
          className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Žmonių skaičius */}
      <div>
        <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
          Vaikų skaičius
        </label>
        <input
          type="number"
          min={1}
          value={zmones}
          onChange={(e) => setZmones(e.target.value)}
          placeholder="pvz. 10"
          className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <button
        type="submit"
        className="ui-font mt-1 w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-dark md:w-auto"
      >
        Atnaujinti paiešką
      </button>
    </form>
  );
}
