"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import Loader from "../components/Loader";

function resolveRouteByRole(role, fallbackPath = "/account") {
  if (!role) {
    return "/prisijungti";
  }

  if (role === "client") {
    return fallbackPath === "/partner" ? "/account" : fallbackPath;
  }

  if (role === "partner" || role === "venue_owner" || role === "service_provider") {
    return "/partner";
  }

  if (role === "admin") {
    return "/admin";
  }

  return "/account";
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nextPath = useMemo(() => {
    return searchParams.get("next") || "/account";
  }, [searchParams]);
  const isRegisterCallback = searchParams.get("mode") === "register";

  useEffect(() => {
    let isMounted = true;

    async function activatePartnerInvite(user, inviteToken) {
      const { data: invite, error: inviteError } = await supabase
        .from("partner_invites")
        .select("id, email, status, expires_at")
        .eq("token", inviteToken)
        .maybeSingle();

      if (inviteError) {
        throw inviteError;
      }

      const inviteExpired =
        invite?.expires_at && new Date(invite.expires_at).getTime() < Date.now();

      if (!invite || invite.status !== "pending" || inviteExpired) {
        throw new Error("Partnerio kvietimo nuoroda nebegalioja.");
      }

      if ((invite.email || "").toLowerCase() !== (user.email || "").toLowerCase()) {
        throw new Error("Kvietimas skirtas kitam el. pašto adresui.");
      }

      const { error: upsertError } = await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email || invite.email || null,
          full_name: user.user_metadata?.full_name || null,
          role: "partner",
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        throw upsertError;
      }

      const { error: inviteUpdateError } = await supabase
        .from("partner_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_user_id: user.id,
        })
        .eq("id", invite.id);

      if (inviteUpdateError) {
        throw inviteUpdateError;
      }

      return "partner";
    }

    async function ensureRegisteredUser(user) {
      if (!user?.id) return;

      const { data: userRow, error: userRowError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (userRowError) {
        throw userRowError;
      }

      if (!userRow?.id || !userRow?.role) {
        const inviteToken = user.user_metadata?.partner_invite_token;

        if (inviteToken) {
          return activatePartnerInvite(user, inviteToken);
        }

        if (isRegisterCallback) {
          const { error: upsertError } = await supabase.from("users").upsert(
            {
              id: user.id,
              email: user.email || null,
              full_name: user.user_metadata?.full_name || null,
              role: "client",
            },
            { onConflict: "id" },
          );

          if (upsertError) {
            throw upsertError;
          }

          return "client";
        }

        await supabase.auth.signOut();
        setErrorMsg("Paskyra nerasta. Pirmiausia susikurkite paskyrą.");
        setCheckingAuth(false);
        return null;
      }

      return userRow.role;
    }

    async function redirectAuthenticatedUser(user) {
      const role = await ensureRegisteredUser(user);
      if (!isMounted || !role) return;

      router.replace(resolveRouteByRole(role, nextPath));
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
        return true;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("oauth getSession error:", error.message);
      }

      if (!isMounted || !data.session?.user) return false;

      await redirectAuthenticatedUser(data.session.user);
      return true;
    }

    handleOAuthReturn()
      .then((redirected) => {
        if (isMounted && !redirected) {
          setCheckingAuth(false);
        }
      })
      .catch((error) => {
        console.error("oauth return handling error:", error);
        if (isMounted) {
          supabase.auth.signOut();
          setErrorMsg(error?.message || "Nepavyko užbaigti registracijos.");
          setCheckingAuth(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;

        setTimeout(() => {
          if (isMounted) {
            setCheckingAuth(true);
            redirectAuthenticatedUser(session.user);
          }
        }, 0);
      },
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, nextPath, isRegisterCallback]);

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
      setErrorMsg("Nepavyko patikrinti paskyros.");
      return;
    }

    const { data: userRow, error: userRowError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    setLoading(false);

    if (userRowError) {
      console.error("users fetch after login error:", userRowError.message);
      await supabase.auth.signOut();
      setErrorMsg("Nepavyko patikrinti paskyros.");
      return;
    }

    if (!userRow?.id || !userRow?.role) {
      await supabase.auth.signOut();
      setErrorMsg("Paskyra nerasta. Pirmiausia susikurkite paskyrą.");
      return;
    }

    router.push(resolveRouteByRole(userRow.role, nextPath));
  }

  async function handleGoogleLogin() {
    setErrorMsg("");
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/prisijungti?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      console.error("google oauth start error:", error.message);
      setErrorMsg("Nepavyko pradėti prisijungimo su Google.");
      setGoogleLoading(false);
    }
  }

  if (checkingAuth || googleLoading) {
    return <Loader message="Tikriname prisijungimą..." />;
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
            {errorMsg}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader message="Tikriname prisijungimą..." />}>
      <LoginPageContent />
    </Suspense>
  );
}
