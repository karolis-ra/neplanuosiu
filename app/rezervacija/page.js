// app/rezervacija/page.js
import { Suspense } from "react";
import ReservationClient from "./ReservationClient";

export default function ReservationPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-slate-500 ui-font">Kraunama...</p>
        </main>
      }
    >
      <ReservationClient />
    </Suspense>
  );
}
