// app/components/BookingDateTimePicker.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const MONTHS_LT = [
  "Sausis",
  "Vasaris",
  "Kovas",
  "Balandis",
  "Gegužė",
  "Birželis",
  "Liepa",
  "Rugpjūtis",
  "Rugsėjis",
  "Spalis",
  "Lapkritis",
  "Gruodis",
];

function formatDate(date) {
  // YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// ar du intervalai [aStart,aEnd) ir [bStart,bEnd) persidengia
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default function BookingDateTimePicker({
  roomId,
  durationMinutes = 120,
  bufferMinutes = 0,
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [busyInfo, setBusyInfo] = useState({ bookings: [], blocks: [] });
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1) parsinešam visą savaitės availability kambariui
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        setLoadingMonth(true);
        setError(null);
        const { data, error: aErr } = await supabase
          .from("availability")
          .select("weekday, start_time, end_time")
          .eq("room_id", roomId);

        if (aErr) throw aErr;
        setAvailability(data || []);
      } catch (e) {
        console.error("availability error", e);
        setError("Nepavyko užkrauti kambario kalendoriaus.");
      } finally {
        setLoadingMonth(false);
      }
    })();
  }, [roomId]);

  // 2) kai pasirenka dieną – parsinešam bookings + room_unavailability tam room ir datai
  useEffect(() => {
    if (!roomId || !selectedDate) return;

    (async () => {
      try {
        setLoadingDay(true);
        setError(null);
        const dateStr = formatDate(selectedDate);

        const [{ data: bookings }, { data: blocks }] = await Promise.all([
          supabase
            .from("bookings")
            .select("start_time, end_time")
            .eq("room_id", roomId)
            .eq("event_date", dateStr),
          supabase
            .from("room_unavailability")
            .select("start_time, end_time")
            .eq("room_id", roomId)
            .eq("date", dateStr),
        ]);

        setBusyInfo({
          bookings: bookings || [],
          blocks: blocks || [],
        });
      } catch (e) {
        console.error("bookings/unavailability error", e);
        setError("Nepavyko užkrauti pasirinktos dienos laikų.");
      } finally {
        setLoadingDay(false);
      }
    })();
  }, [roomId, selectedDate]);

  // 3) apskaičiuojam, kurios dienos turi bent vieną galimą slotą (tam mėnesiui)
  const daysWithOpening = useMemo(() => {
    if (!availability.length) return new Set();
    const result = new Set();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const weekday = d.getDay(); // 0-6, kaip tavo DB
      const dayAvail = availability.filter((a) => a.weekday === weekday);
      if (dayAvail.length === 0) continue;

      // jei bent vienas availability intervalas ilgesnis už event trukmę – žymim kaip atidaromą dieną
      const hasSlot = dayAvail.some((a) => {
        const start = parseTimeToMinutes(a.start_time);
        const end = parseTimeToMinutes(a.end_time);
        return end - start >= durationMinutes;
      });

      if (hasSlot) {
        result.add(formatDate(d));
      }
    }

    return result;
  }, [availability, currentMonth, durationMinutes]);

  // 4) apskaičiuojam slotus pasirinktai dienai, atsižvelgiant į bookings + blocks
  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    const weekday = selectedDate.getDay();
    const dayAvail = availability.filter((a) => a.weekday === weekday);

    if (dayAvail.length === 0) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    const bookings = busyInfo.bookings || [];
    const blocks = busyInfo.blocks || [];

    const newSlots = [];

    dayAvail.forEach((a) => {
      const start = parseTimeToMinutes(a.start_time);
      const end = parseTimeToMinutes(a.end_time);
      const step = 30; // kas 30 min
      const eventLength = durationMinutes + bufferMinutes;

      for (let t = start; t + durationMinutes <= end; t += step) {
        const slotStart = t;
        const slotEnd = t + durationMinutes;

        // patikrinam persidengimą su bookings
        const overlapsBooking = bookings.some((b) => {
          const bStart = parseTimeToMinutes(b.start_time);
          const bEnd = parseTimeToMinutes(b.end_time);
          return rangesOverlap(slotStart, slotEnd, bStart, bEnd);
        });

        if (overlapsBooking) continue;

        // patikrinam persidengimą su blokais
        const overlapsBlock = blocks.some((b) => {
          const bStart = parseTimeToMinutes(b.start_time);
          const bEnd = parseTimeToMinutes(b.end_time);
          return rangesOverlap(slotStart, slotEnd, bStart, bEnd);
        });

        if (overlapsBlock) continue;

        newSlots.push({
          label: `${minutesToTimeStr(slotStart)}–${minutesToTimeStr(slotEnd)}`,
          value: minutesToTimeStr(slotStart),
        });
      }
    });

    setSlots(newSlots);
    setSelectedSlot(null);
  }, [selectedDate, availability, busyInfo, durationMinutes, bufferMinutes]);

  function changeMonth(offset) {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + offset);
    setCurrentMonth(d);
    setSelectedDate(null);
    setSlots([]);
    setSelectedSlot(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) return;
    setIsSubmitting(true);

    try {
      // čia vėliau kelsim į supabase bookings insert
      console.log("Booking request:", {
        roomId,
        date: formatDate(selectedDate),
        time: selectedSlot,
      });
      alert(
        `Rezervacijos užklausa:\n${formatDate(selectedDate)} ${selectedSlot}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0-6

  const dayCells = [];
  for (let i = 0; i < firstWeekday; i++) {
    dayCells.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = formatDate(d);
    const isAvailable = daysWithOpening.has(dateStr);
    const isSelected = selectedDate && formatDate(selectedDate) === dateStr;

    dayCells.push(
      <button
        key={day}
        type="button"
        disabled={!isAvailable}
        onClick={() => isAvailable && setSelectedDate(d)}
        className={[
          "ui-font flex h-8 w-8 items-center justify-center rounded-full text-xs",
          isSelected
            ? "bg-primary text-white"
            : isAvailable
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : "text-slate-300",
        ].join(" ")}
      >
        {day}
      </button>
    );
  }

  const isValid = selectedDate && selectedSlot;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h2 className="heading text-lg font-semibold text-dark">
        Pasirink šventės datą ir laiką
      </h2>

      {error && <p className="ui-font text-xs text-red-600">{error}</p>}

      {/* Kalendorius + laikas */}
      <div className="grid gap-4 md:grid-cols-[2fr,3fr] items-start">
        {/* Mini kalendorius */}
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="ui-font text-xs text-slate-500 hover:text-primary"
            >
              ←
            </button>
            <span className="ui-font text-xs font-semibold text-slate-700">
              {year} m. {MONTHS_LT[month]}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="ui-font text-xs text-slate-500 hover:text-primary"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {["S", "P", "A", "T", "K", "Pn", "Š"].map((d) => (
              <div
                key={d}
                className="ui-font mb-1 text-[10px] font-semibold text-slate-400"
              >
                {d}
              </div>
            ))}
            {dayCells}
          </div>
        </div>

        {/* Laiko slotai */}
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="ui-font mb-2 text-xs text-slate-600">
            {selectedDate
              ? `Pasirinkta: ${formatDate(selectedDate)}`
              : "Pirma pasirink datą kalendoriuje."}
          </p>

          {loadingDay && selectedDate && (
            <p className="ui-font text-xs text-slate-500">
              Kraunami laisvi laikai...
            </p>
          )}

          {!loadingDay && selectedDate && slots.length === 0 && (
            <p className="ui-font text-xs text-slate-500">
              Šią dieną laisvų laikų nėra.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={slot.value}
                type="button"
                onClick={() => setSelectedSlot(slot.value)}
                className={[
                  "ui-font rounded-full border px-3 py-1 text-xs",
                  selectedSlot === slot.value
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary",
                ].join(" ")}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {durationMinutes && (
        <p className="ui-font text-xs text-slate-500">
          Šventės trukmė šiame kambaryje – apie{" "}
          <span className="font-semibold">{durationMinutes} min</span>.
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="ui-font mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? "Siunčiama..." : "Tęsti rezervaciją"}
      </button>
    </form>
  );
}
