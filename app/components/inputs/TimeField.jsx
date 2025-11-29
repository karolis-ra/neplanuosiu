import DatePicker from "react-datepicker";

export default function TimeField({ value, onChange }) {
  const minTime = new Date();
  minTime.setHours(9, 0, 0, 0);

  const maxTime = new Date();
  maxTime.setHours(18, 0, 0, 0);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700">
        Šventės pradžia
      </label>

      <div className="relative">
        <DatePicker
          selected={value}
          onChange={onChange}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={30}
          timeFormat="HH:mm"
          dateFormat="HH:mm"
          timeCaption="Laikas"
          locale="lt"
          placeholderText="Pasirink laiką"
          minTime={minTime}
          maxTime={maxTime}
          className="
            w-full
            rounded-full
            border border-slate-200
            bg-white/95
            px-4
            py-2.5
            pr-10
            text-sm
            focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30
            shadow-sm
            placeholder:text-slate-400
          "
          wrapperClassName="w-full"
          popperPlacement="bottom-start"
          popperClassName="custom-time-popper"
        />

        {/* Laikrodžio ikona */}
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
