// app/rezervacija/page.js
import { Suspense } from "react";
import ReservationClient from "./ReservationClient";
import Loader from "../components/Loader";

export default function ReservationPage() {
  return (
    <Suspense
      fallback={<Loader message="Kraunama rezervacija..." />}
    >
      <ReservationClient />
    </Suspense>
  );
}
