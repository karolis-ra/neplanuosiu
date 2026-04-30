"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function SelectControl({
  value,
  onChange,
  options = [],
  placeholder = "Pasirinkite",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedOption = options.find((option) => option.value === value);
  const buttonLabel = selectedOption?.label || placeholder;

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
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

  function handleSelect(option) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`ui-font flex w-full items-center justify-between gap-[12px] rounded-[18px] border border-slate-200 bg-white px-[16px] text-left text-[14px] text-slate-800 shadow-sm outline-none transition hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? "text-slate-800" : "text-slate-500"}>
          {buttonLabel}
        </span>
        <ChevronDown
          size={20}
          strokeWidth={2.2}
          className={`shrink-0 text-primary transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-[80] mt-[8px] max-h-[280px] overflow-y-auto rounded-[18px] border border-slate-200 bg-white p-[6px] shadow-xl shadow-slate-900/12 ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
                className={`ui-font flex min-h-[38px] w-full items-center rounded-[12px] px-[12px] text-left text-[14px] transition ${
                  isSelected
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-50 hover:text-primary"
                } disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
