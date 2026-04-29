"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "../../components/Loader";

export default function PartnerServiceRequestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/partner/rezervacijos");
  }, [router]);

  return <Loader />;
}
