import { Suspense } from "react";
import ServicesSelectionClient from "./ServicesSelectionClient";
import Loader from "../../components/Loader";

export default function ReservationServicesPage() {
  return (
    <Suspense
      fallback={<Loader message="Kraunamos papildomos paslaugos..." />}
    >
      <ServicesSelectionClient />
    </Suspense>
  );
}
