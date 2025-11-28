"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerLocale } from "react-datepicker";
import lt from "date-fns/locale/lt";

import CityField from "./inputs/CityField";
import TimeField from "./inputs/TimeField";
import DateField from "./inputs/DateField";

import "react-datepicker/dist/react-datepicker.css";

registerLocale("lt", lt);

export default function Hero() {
  const router = useRouter();
  const [miestas, setMiestas] = useState("");
  const [data, setData] = useState(null);
  const [laikas, setLaikas] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();

    const params = new URLSearchParams();
    if (miestas) params.set("miestas", miestas);
    if (data) params.set("data", data.toISOString().split("T")[0]);
    if (laikas) {
      const h = laikas.getHours().toString().padStart(2, "0");
      const m = laikas.getMinutes().toString().padStart(2, "0");
      params.set("laikas", `${h}:${m}`);
    }

    router.push(`/paieska?${params.toString()}`);
  }

  return (
    <section
      className="
  relative
  h-[70vh]
  min-h-[580px]
  w-full
  overflow-hidden
  py-50
  md:py-0
  md:min-h-[520px]
"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/hero_kid.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto flex align-center w-full max-w-6xl flex-col gap-8 px-4 text-white md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl text-center md:text-left">
            <h1 className="heading mb-4 text-3xl font-bold md:text-5xl">
              Suplanuok vaikų gimtadienį{" "}
              <span className="text-secondary"> be streso</span>
            </h1>
            <p className="ui-font text-base text-slate-100 md:text-lg">
              Pasirink miestą, datą ir laiką – ir surask laisvus žaidimų
              kambarius.
            </p>
          </div>

          <div className="mx-auto w-full max-w-md rounded-3xl bg-white/95 p-5 text-sm text-slate-900 shadow-xl backdrop-blur ui-font">
            <h2 className="heading mb-3 text-lg font-semibold text-dark">
              Rask laisvą žaidimų kambarį
            </h2>

            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <CityField value={miestas} onChange={setMiestas} />

              <DateField value={data} onChange={setData} />

              <TimeField value={laikas} onChange={setLaikas} />

              <button
                type="submit"
                className="mt-2 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-dark"
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
