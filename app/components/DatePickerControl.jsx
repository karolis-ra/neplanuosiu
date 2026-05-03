"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value) {
  if (!value) return null;

  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateLabel(value) {
  const parsed = parseDateKey(value);

  if (!parsed) {
    return "";
  }

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstDayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export default function DatePickerControl({
  value,
  onChange,
  placeholder = "Pasirinkite datą",
  disabled = false,
  className = "",
  buttonClassName = "",
  min,
  max,
}) {
  const wrapperRef = useRef(null);
  const todayKey = toDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDateKey(value) || new Date());

  const days = useMemo(() => getCalendarDays(viewDate), [viewDate]);
  const minDate = parseDateKey(min);
  const maxDate = parseDateKey(max);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  function changeMonth(offset) {
    setViewDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset, 1);
      return next;
    });
  }

  function isDisabledDate(date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  function selectDate(date) {
    if (isDisabledDate(date)) return;
    setViewDate(date);
    onChange(toDateKey(date));
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`ui-font flex h-[48px] w-full items-center justify-between gap-[12px] rounded-[18px] border border-slate-200 bg-white px-[16px] text-left text-[14px] text-slate-800 shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${buttonClassName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-slate-800" : "text-slate-500"}>
          {value ? formatDateLabel(value) : placeholder}
        </span>
        <CalendarDays size={20} strokeWidth={2.2} className="text-primary" />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-[130] mt-[8px] w-full min-w-[310px] rounded-[22px] border border-slate-200 bg-white p-[12px] shadow-2xl shadow-slate-900/15">
          <div className="flex items-center justify-between gap-[12px]">
            <p className="ui-font text-[15px] font-semibold capitalize text-slate-900">
              {formatMonthLabel(viewDate)}
            </p>

            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border border-slate-200 bg-white text-primary transition hover:bg-primary hover:text-white"
                aria-label="Ankstesnis mėnuo"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border border-slate-200 bg-white text-primary transition hover:bg-primary hover:text-white"
                aria-label="Kitas mėnuo"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="mt-[12px] grid grid-cols-7 gap-[4px]">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="ui-font flex h-[30px] items-center justify-center text-[12px] font-semibold text-slate-500"
              >
                {weekday}
              </div>
            ))}

            {days.map((day) => {
              const dateKey = toDateKey(day);
              const isCurrentMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = dateKey === value;
              const isToday = dateKey === todayKey;
              const dateDisabled = isDisabledDate(day);

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={dateDisabled}
                  onClick={() => selectDate(day)}
                  className={`ui-font flex h-[38px] items-center justify-center rounded-[12px] text-[14px] font-medium transition ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : isToday
                        ? "bg-primary/10 text-primary"
                        : isCurrentMonth
                          ? "text-slate-800 hover:bg-slate-50 hover:text-primary"
                          : "text-slate-300 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-white`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-[12px] flex items-center justify-between border-t border-slate-100 pt-[10px]">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="ui-font rounded-[12px] px-[12px] py-[8px] text-[13px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Išvalyti
            </button>
            <button
              type="button"
              onClick={() => selectDate(new Date())}
              className="ui-font rounded-[12px] px-[12px] py-[8px] text-[13px] font-semibold text-primary transition hover:bg-primary/10"
            >
              Šiandien
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
