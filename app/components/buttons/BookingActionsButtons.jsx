"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

export default function BookingActionButtons({
  roomId,
  selectedDate,
  selectedTime,
  baseDurationMinutes,
  extraMinutes,
  totalPrice,
}) {
  const router = useRouter();

  const params = useMemo(() => {
    const query = new URLSearchParams();
    query.set("roomId", String(roomId));
    query.set("date", selectedDate);
    query.set("time", selectedTime);
    query.set(
      "duration",
      String(Number(baseDurationMinutes || 0) + Number(extraMinutes || 0)),
    );
    query.set("baseDuration", String(baseDurationMinutes || 0));
    query.set("extraMinutes", String(extraMinutes || 0));
    query.set("roomTotal", String(totalPrice || 0));
    return query.toString();
  }, [
    roomId,
    selectedDate,
    selectedTime,
    baseDurationMinutes,
    extraMinutes,
    totalPrice,
  ]);

  const disabled = !roomId || !selectedDate || !selectedTime;

  return (
    <div className="space-y-[12px]">
      <div className="grid gap-[10px] sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => router.push(`/rezervacija?${params}`)}
          className="ui-font inline-flex h-[48px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Rezervuoti tik kambarį
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => router.push(`/rezervacija/paslaugos?${params}`)}
          className="ui-font inline-flex h-[48px] items-center justify-center rounded-[18px] border border-primary bg-white px-[18px] text-[15px] font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          Užsakyti papildomas paslaugas
        </button>
      </div>

      <p className="ui-font text-center text-[13px] leading-[20px] text-slate-500">
        Galite pasirinkti papildomas paslaugas: dekoracijas, animatorių ar tortą
        pagal pasirinktą rezervacijos laiką.
      </p>
    </div>
  );
}
