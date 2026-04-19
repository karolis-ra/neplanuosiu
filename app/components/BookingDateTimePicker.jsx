"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import BookingActionButtons from "./buttons/BookingActionsButtons";

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

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function getWeekdayFromDate(date) {
  return date.getDay();
}

function buildBusyIntervals(bookings = [], blocks = []) {
  const bookingIntervals = bookings.map((b) => ({
    start: parseTimeToMinutes(String(b.start_time).slice(0, 5)),
    end: parseTimeToMinutes(String(b.end_time).slice(0, 5)),
  }));

  const blockIntervals = blocks.map((b) => ({
    start: parseTimeToMinutes(String(b.start_time).slice(0, 5)),
    end: parseTimeToMinutes(String(b.end_time).slice(0, 5)),
  }));

  return [...bookingIntervals, ...blockIntervals].sort(
    (a, b) => a.start - b.start,
  );
}

export default function BookingDateTimePicker({
  roomId,
  durationMinutes = 120,
  bufferMinutes = 0,
  basePrice = 0,
  extraHourPrice = 0,
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [busyInfo, setBusyInfo] = useState({ bookings: [], blocks: [] });
  const [availableStartSlots, setAvailableStartSlots] = useState([]);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [wantsExtraTime, setWantsExtraTime] = useState("no");
  const [selectedExtraHours, setSelectedExtraHours] = useState(0);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!roomId || !selectedDate) return;

    (async () => {
      try {
        setLoadingDay(true);
        setError(null);

        const dateStr = formatDate(selectedDate);

        const [bookingsRes, blocksRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("start_time, end_time, status")
            .eq("room_id", roomId)
            .eq("event_date", dateStr),
          supabase
            .from("room_unavailability")
            .select("start_time, end_time")
            .eq("room_id", roomId)
            .eq("date", dateStr),
        ]);

        if (bookingsRes.error) throw bookingsRes.error;
        if (blocksRes.error) throw blocksRes.error;

        const activeBookings = (bookingsRes.data || []).filter((b) => {
          if (!b.status) return true;
          return b.status !== "cancelled";
        });

        setBusyInfo({
          bookings: activeBookings,
          blocks: blocksRes.data || [],
        });
      } catch (e) {
        console.error("bookings/unavailability error", e);
        setError("Nepavyko užkrauti pasirinktos dienos laikų.");
      } finally {
        setLoadingDay(false);
      }
    })();
  }, [roomId, selectedDate]);

  const daysWithOpening = useMemo(() => {
    if (!availability.length) return new Set();

    const result = new Set();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const weekday = getWeekdayFromDate(d);
      const dayAvail = availability.filter((a) => a.weekday === weekday);

      if (!dayAvail.length) continue;

      const hasSlot = dayAvail.some((a) => {
        const start = parseTimeToMinutes(String(a.start_time).slice(0, 5));
        const end = parseTimeToMinutes(String(a.end_time).slice(0, 5));
        return end - start >= durationMinutes + bufferMinutes;
      });

      if (hasSlot) {
        result.add(formatDate(d));
      }
    }

    return result;
  }, [availability, currentMonth, durationMinutes, bufferMinutes]);

  useEffect(() => {
    if (!selectedDate) {
      setAvailableStartSlots([]);
      setSelectedStartTime("");
      setWantsExtraTime("no");
      setSelectedExtraHours(0);
      return;
    }

    const weekday = getWeekdayFromDate(selectedDate);
    const dayAvail = availability.filter((a) => a.weekday === weekday);

    if (!dayAvail.length) {
      setAvailableStartSlots([]);
      setSelectedStartTime("");
      setWantsExtraTime("no");
      setSelectedExtraHours(0);
      return;
    }

    const busyIntervals = buildBusyIntervals(
      busyInfo.bookings,
      busyInfo.blocks,
    );

    const newSlots = [];
    const step = 30;

    dayAvail.forEach((a) => {
      const availStart = parseTimeToMinutes(String(a.start_time).slice(0, 5));
      const availEnd = parseTimeToMinutes(String(a.end_time).slice(0, 5));

      for (
        let t = availStart;
        t + durationMinutes + bufferMinutes <= availEnd;
        t += step
      ) {
        const bookingEnd = t + durationMinutes;
        const occupiedUntil = bookingEnd + bufferMinutes;

        const hasConflict = busyIntervals.some((interval) =>
          rangesOverlap(t, occupiedUntil, interval.start, interval.end),
        );

        if (!hasConflict) {
          newSlots.push({
            value: minutesToTimeStr(t),
            label: `${minutesToTimeStr(t)} - ${minutesToTimeStr(bookingEnd)}`,
          });
        }
      }
    });

    setAvailableStartSlots(newSlots);
    setSelectedStartTime("");
    setWantsExtraTime("no");
    setSelectedExtraHours(0);
  }, [selectedDate, availability, busyInfo, durationMinutes, bufferMinutes]);

  const extraHourOptions = useMemo(() => {
    if (!selectedDate || !selectedStartTime) return [];

    const weekday = getWeekdayFromDate(selectedDate);
    const dayAvail = availability.filter((a) => a.weekday === weekday);
    if (!dayAvail.length) return [];

    const startMinutes = parseTimeToMinutes(selectedStartTime);
    const busyIntervals = buildBusyIntervals(
      busyInfo.bookings,
      busyInfo.blocks,
    );

    const containingAvailability = dayAvail.find((a) => {
      const aStart = parseTimeToMinutes(String(a.start_time).slice(0, 5));
      const aEnd = parseTimeToMinutes(String(a.end_time).slice(0, 5));
      return aStart <= startMinutes && aEnd >= startMinutes + durationMinutes;
    });

    if (!containingAvailability) return [];

    const availEnd = parseTimeToMinutes(
      String(containingAvailability.end_time).slice(0, 5),
    );

    let nextConflictStart = availEnd;

    busyIntervals.forEach((interval) => {
      if (interval.start >= startMinutes + durationMinutes) {
        nextConflictStart = Math.min(nextConflictStart, interval.start);
      }
    });

    const maxExtraMinutes =
      nextConflictStart - startMinutes - durationMinutes - bufferMinutes;

    if (maxExtraMinutes < 60) return [];

    const maxFullHours = Math.min(4, Math.floor(maxExtraMinutes / 60));

    return Array.from({ length: maxFullHours }, (_, i) => ({
      value: i + 1,
      label: `+${i + 1} val.`,
    }));
  }, [
    selectedDate,
    selectedStartTime,
    availability,
    busyInfo,
    durationMinutes,
    bufferMinutes,
  ]);

  useEffect(() => {
    if (wantsExtraTime === "no") {
      setSelectedExtraHours(0);
      return;
    }

    if (!extraHourOptions.length) {
      setWantsExtraTime("no");
      setSelectedExtraHours(0);
      return;
    }

    const stillValid = extraHourOptions.some(
      (opt) => opt.value === selectedExtraHours,
    );

    if (!stillValid) {
      setSelectedExtraHours(extraHourOptions[0]?.value || 0);
    }
  }, [wantsExtraTime, extraHourOptions, selectedExtraHours]);

  function changeMonth(offset) {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + offset);
    setCurrentMonth(d);
    setSelectedDate(null);
    setAvailableStartSlots([]);
    setSelectedStartTime("");
    setWantsExtraTime("no");
    setSelectedExtraHours(0);
  }

  const totalDurationMinutes =
    durationMinutes + (wantsExtraTime === "yes" ? selectedExtraHours * 60 : 0);

  const extraHours =
    wantsExtraTime === "yes" ? Number(selectedExtraHours || 0) : 0;

  const extraMinutes = extraHours * 60;

  const extraPrice = extraHours * Number(extraHourPrice || 0);
  const totalPrice = Number(basePrice || 0) + extraPrice;

  const startMinutes = selectedStartTime
    ? parseTimeToMinutes(selectedStartTime)
    : null;

  const endMinutes =
    startMinutes != null ? startMinutes + totalDurationMinutes : null;

  const selectedDateStr = selectedDate ? formatDate(selectedDate) : "";

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

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
          "ui-font flex h-[42px] w-[42px] items-center justify-center rounded-full text-[14px] font-semibold transition-all duration-200",
          isSelected
            ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.03]"
            : isAvailable
              ? "bg-white text-primary border border-primary/12 hover:border-primary/25 hover:bg-primary/8 hover:shadow-sm"
              : "bg-transparent text-slate-300 cursor-not-allowed",
        ].join(" ")}
      >
        {day}
      </button>,
    );
  }

  const isValid = !!selectedDate && !!selectedStartTime;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="heading text-[22px] font-semibold text-dark">
          Pasirink šventės datą ir laiką
        </h2>
        <p className="ui-font text-[14px] text-slate-500">
          Pasirink datą, pradžios laiką ir, jei reikia, pridėk papildomų
          valandų.
        </p>
      </div>

      {error && (
        <div className="rounded-[20px] border border-red-100 bg-red-50 px-4 py-3">
          <p className="ui-font text-[13px] text-red-600">{error}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-slate-200 bg-white text-[16px] text-slate-600 transition hover:border-primary/30 hover:text-primary"
            >
              ←
            </button>

            <span className="ui-font text-[15px] font-semibold text-slate-800">
              {year} m. {MONTHS_LT[month]}
            </span>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-slate-200 bg-white text-[16px] text-slate-600 transition hover:border-primary/30 hover:text-primary"
            >
              →
            </button>
          </div>

          <div className="mb-3 grid grid-cols-7 gap-[8px] text-center">
            {["S", "P", "A", "T", "K", "Pn", "Š"].map((d) => (
              <div
                key={d}
                className="ui-font flex h-[24px] items-center justify-center text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-[8px]">
            {loadingMonth ? (
              <div className="col-span-7 rounded-[16px] bg-slate-50 px-4 py-3">
                <p className="ui-font text-[13px] text-slate-500">
                  Kraunamas kalendorius...
                </p>
              </div>
            ) : (
              dayCells
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="ui-font mb-4 text-[14px] text-slate-600">
            {selectedDate
              ? `Pasirinkta data: ${formatDate(selectedDate)}`
              : "Pirma pasirink datą kalendoriuje."}
          </p>

          {loadingDay && selectedDate && (
            <p className="ui-font text-[14px] text-slate-500">
              Kraunami laisvi laikai...
            </p>
          )}

          {!loadingDay && selectedDate && availableStartSlots.length === 0 && (
            <div className="rounded-[18px] bg-slate-50 px-4 py-3">
              <p className="ui-font text-[14px] text-slate-500">
                Šią dieną laisvų laikų nėra.
              </p>
            </div>
          )}

          {!loadingDay && selectedDate && availableStartSlots.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="ui-font block text-[13px] font-semibold text-slate-700">
                  Pradžios laikas
                </label>
                <select
                  value={selectedStartTime}
                  onChange={(e) => {
                    setSelectedStartTime(e.target.value);
                    setWantsExtraTime("no");
                    setSelectedExtraHours(0);
                  }}
                  className="ui-font h-[52px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                >
                  <option value="">Pasirink laiką</option>
                  {availableStartSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStartTime && (
                <div className="space-y-4 rounded-[22px] border border-slate-100 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <label className="ui-font block text-[13px] font-semibold text-slate-700">
                      Ar norite papildomo laiko?
                    </label>
                    <select
                      value={wantsExtraTime}
                      onChange={(e) => setWantsExtraTime(e.target.value)}
                      className="ui-font h-[52px] w-full rounded-[18px] border border-slate-200 bg-white px-4 text-[14px] text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    >
                      <option value="no">Ne</option>
                      <option
                        value="yes"
                        disabled={extraHourOptions.length === 0}
                      >
                        Taip
                      </option>
                    </select>
                  </div>

                  {wantsExtraTime === "yes" && extraHourOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="ui-font block text-[13px] font-semibold text-slate-700">
                        Papildomas laikas
                      </label>
                      <select
                        value={selectedExtraHours}
                        onChange={(e) =>
                          setSelectedExtraHours(Number(e.target.value))
                        }
                        className="ui-font h-[52px] w-full rounded-[18px] border border-slate-200 bg-white px-4 text-[14px] text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      >
                        {extraHourOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedStartTime && extraHourOptions.length === 0 && (
                    <div className="rounded-[16px] bg-white px-4 py-3">
                      <p className="ui-font text-[13px] leading-[20px] text-slate-500">
                        Šiam laikui papildomų valandų pridėti negalima, nes turi
                        likti laiko kambario paruošimui prieš kitą rezervaciją.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="ui-font mb-4 text-[15px] font-semibold text-slate-800">
          Rezervacijos suvestinė
        </h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="ui-font text-[14px] text-slate-500">
                Standartinė trukmė
              </span>
              <span className="ui-font text-[14px] font-semibold text-slate-800">
                {durationMinutes} min
              </span>
            </div>

            {selectedStartTime && endMinutes != null && (
              <div className="flex items-center justify-between gap-4">
                <span className="ui-font text-[14px] text-slate-500">
                  Rezervacijos laikas
                </span>
                <span className="ui-font text-[14px] font-semibold text-slate-800">
                  {selectedStartTime} - {minutesToTimeStr(endMinutes)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <span className="ui-font text-[14px] text-slate-500">
                Bazinė kaina
              </span>
              <span className="ui-font text-[14px] font-semibold text-slate-800">
                {Number(basePrice || 0).toFixed(2)} €
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {wantsExtraTime === "yes" && selectedExtraHours > 0 ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="ui-font text-[14px] text-slate-500">
                    Papildomas laikas
                  </span>
                  <span className="ui-font text-[14px] font-semibold text-slate-800">
                    {selectedExtraHours} val.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="ui-font text-[14px] text-slate-500">
                    Papildomo laiko kaina
                  </span>
                  <span className="ui-font text-[14px] font-semibold text-slate-800">
                    {Number(extraPrice || 0).toFixed(2)} €
                  </span>
                </div>
              </>
            ) : (
              <div className="rounded-[16px] bg-slate-50 px-4 py-3">
                <p className="ui-font text-[13px] text-slate-500">
                  Papildomas laikas nepasirinktas.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="my-5 h-px bg-slate-200" />

        <div className="flex items-center justify-between gap-4">
          <span className="ui-font text-[15px] font-semibold text-slate-700">
            Iš viso
          </span>
          <span className="ui-font text-[18px] font-semibold text-dark">
            {Number(totalPrice || 0).toFixed(2)} €
          </span>
        </div>
      </div>

      <BookingActionButtons
        roomId={roomId}
        selectedDate={selectedDateStr}
        selectedTime={selectedStartTime}
        baseDurationMinutes={durationMinutes}
        extraHours={extraHours}
        extraMinutes={extraMinutes}
        basePrice={basePrice}
        extraHourPrice={extraHourPrice}
        totalPrice={totalPrice}
      />
    </div>
  );
}
