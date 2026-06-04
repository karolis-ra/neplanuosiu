"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "../../../components/Loader";

export default function ServiceProviderOnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/partner/paslaugos");
  }, [router]);

  return <Loader message="Atidaromas paslaugų valdymas..." />;
}
