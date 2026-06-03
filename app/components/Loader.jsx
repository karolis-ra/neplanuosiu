// app/components/Loader.jsx

export default function Loader({ message = "Kraunama..." }) {
  return (
    <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
      <div className="relative max-w-md w-full rounded-3xl bg-white/90 border border-slate-100 shadow-sm px-10 py-10 text-center">
        <div className="mb-4 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>

        <div className="mb-2 text-2xl">🎉</div>

        <p className="ui-font text-xs uppercase tracking-[1px] text-primary mb-1">
          Luktelkite kelias sekundes
        </p>
        <p className="ui-font text-sm text-slate-600">
          {message || "Kraunama..."} Beveik viskas paruošta.
        </p>
      </div>
    </section>
  );
}
