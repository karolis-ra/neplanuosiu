"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import Loader from "../components/Loader";

function getDestination(role) {
  if (role === "admin") return "/admin";
  if (role === "partner" || role === "venue_owner" || role === "service_provider") {
    return "/partner";
  }
  return "/account";
}

export default function AccountTypeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectUser() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (authError) {
        console.error("auth error:", authError.message);
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, role, email, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (userError) {
        console.error("user role fetch error:", userError.message);
      }

      if (!userRow?.id || !userRow?.role) {
        await supabase.auth.signOut();
        router.replace("/prisijungti");
        return;
      }

      router.replace(getDestination(userRow.role));
    }

    redirectUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <Loader message="Atidarome paskyrą..." />;
}
