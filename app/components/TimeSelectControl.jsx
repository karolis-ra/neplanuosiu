"use client";

import { useMemo } from "react";
import SelectControl from "./SelectControl";

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildTimeOptions(stepMinutes) {
  const totalMinutesInDay = 24 * 60;

  return Array.from(
    { length: totalMinutesInDay / stepMinutes },
    (_, index) => {
      const minutes = index * stepMinutes;
      const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

      return {
        value,
        label: value,
      };
    },
  );
}

export default function TimeSelectControl({
  value,
  onChange,
  placeholder = "Pasirinkite laiką",
  disabled = false,
  stepMinutes = 15,
  className = "",
  buttonClassName = "",
}) {
  const options = useMemo(
    () => buildTimeOptions(stepMinutes),
    [stepMinutes],
  );

  return (
    <SelectControl
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      buttonClassName={`h-[48px] ${buttonClassName}`}
      menuClassName="z-[140]"
    />
  );
}
