"use client";

// app/components/Loader.jsx

import { useEffect } from "react";

export default function Loader({ message = "Kraunama..." }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <section className="fixed inset-0 z-[220] flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white/90 px-10 py-10 text-center shadow-sm">
        <div className="mb-4 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>

        <div className="mb-2 text-2xl">🎉</div>

        <p className="ui-font mb-1 text-xs uppercase tracking-[1px] text-primary">
          Luktelkite kelias sekundes
        </p>
        <p className="ui-font text-sm text-slate-600">
          {message || "Kraunama..."} Beveik viskas paruošta.
        </p>
      </div>
    </section>
  );
}
