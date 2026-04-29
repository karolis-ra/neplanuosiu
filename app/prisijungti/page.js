"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function resolveRouteByRole(role, fallbackPath = "/account") {
  if (!role) {
    return "/paskyros-tipas";
  }

  if (role === "client") {
    return fallbackPath === "/partner" ? "/account" : fallbackPath;
  }

  if (role === "venue_owner" || role === "service_provider") {
    return "/partner";
  }

  return "/account";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nextPath = useMemo(() => {
    return searchParams.get("next") || "/account";
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    async function redirectAuthenticatedUser(user) {
      if (!user?.id) return;

      const { data: userRow, error: userRowError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (userRowError) {
        console.error("users fetch after oauth error:", userRowError.message);
      }

      const role = userRow?.role || null;
      const targetPath = resolveRouteByRole(role, nextPath);

      router.replace(targetPath);
    }

    async function setSessionFromUrlHash() {
      if (typeof window === "undefined" || !window.location.hash) return null;

      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!accessToken || !refreshToken) return null;

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("oauth setSession error:", error.message);
        setErrorMsg("Nepavyko užbaigti prisijungimo su Google.");
        return null;
      }

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );

      return data.session || null;
    }

    async function handleOAuthReturn() {
      const hashSession = await setSessionFromUrlHash();

      if (!isMounted) return;

      if (hashSession?.user) {
        await redirectAuthenticatedUser(hashSession.user);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("oauth getSession error:", error.message);
      }

      if (!isMounted || !data.session?.user) return;

      await redirectAuthenticatedUser(data.session.user);
    }

    handleOAuthReturn();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;

        setTimeout(() => {
          if (isMounted) {
            redirectAuthenticatedUser(session.user);
          }
        }, 0);
      },
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, nextPath]);

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const user = data?.user;

    if (!user) {
      router.push("/account");
      return;
    }

    const { data: userRow, error: userRowError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userRowError) {
      console.error("users fetch after login error:", userRowError.message);
    }

    const role = userRow?.role || null;
    const targetPath = resolveRouteByRole(role, nextPath);

    router.push(targetPath);
  }

  async function handleGoogleLogin() {
    setErrorMsg("");
    setGoogleLoading(true);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/prisijungti?next=${encodeURIComponent(nextPath)}`,
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="heading mb-4 text-2xl font-bold text-dark">Prisijungti</h1>

      <form
        onSubmit={handleLogin}
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
      >
        <div>
          <label className="ui-font mb-1 block text-sm font-semibold text-slate-700">
            El. paštas
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="ui-font mb-1 block text-sm font-semibold text-slate-700">
            Slaptažodis
          </label>
          <input
            type="password"
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {errorMsg && (
          <p className="ui-font text-xs text-red-600">
            Neteisingi prisijungimo duomenys.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="ui-font w-full rounded-xl bg-primary py-2 text-md font-semibold text-white shadow-md hover:bg-dark disabled:bg-slate-300"
        >
          {loading ? "Jungiama..." : "Prisijungti"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading || googleLoading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-md ui-font hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <img src="/icons/google.png" alt="Google icon" className="w-5 h-5" />
        {googleLoading ? "Jungiama..." : "Prisijungti su Google"}
      </button>

      <p className="ui-font mt-3 text-center text-sm text-slate-600">
        Neturite paskyros?{" "}
        <a href="/registracija" className="text-primary hover:text-dark">
          Sukurti paskyrą
        </a>
      </p>
    </div>
  );
}
