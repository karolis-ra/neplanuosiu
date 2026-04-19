import { Suspense } from "react";
import ServicesSelectionClient from "./ServicesSelectionClient";

export default function ReservationServicesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1100px] px-[16px] py-[40px]">
          <p className="ui-font text-[14px] text-slate-500">Kraunama...</p>
        </main>
      }
    >
      <ServicesSelectionClient />
    </Suspense>
  );
}
