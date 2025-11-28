import DatePicker from "react-datepicker";

export default function DateField({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-700">
        Šventės data
      </label>

      <div className="relative">
        <DatePicker
          selected={value}
          onChange={onChange}
          minDate={new Date()}
          dateFormat="yyyy-MM-dd"
          placeholderText="Pasirink datą"
          locale="lt"
          wrapperClassName="w-full"
          className="
            w-full
            h-[40px]
            rounded-full
            border border-slate-200
            bg-white/95
            px-4
            pr-10
            text-sm
            shadow-sm
            placeholder:text-slate-400
            focus:border-primary
            focus:outline-none
            focus:ring-2
            focus:ring-primary/30
          "
        />

        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <rect x="3.5" y="5" width="17" height="15" rx="2" ry="2" />
            <path d="M8 3.5V7" strokeLinecap="round" />
            <path d="M16 3.5V7" strokeLinecap="round" />
            <path d="M3.5 10H20.5" />
          </svg>
        </span>
      </div>
    </div>
  );
}
