"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function isExistingAuthUser(user) {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      const createdUser = data?.user;

      if (isExistingAuthUser(createdUser)) {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
        });

        if (resendError) {
          console.warn("signup confirmation resend warning:", resendError);
        }

        setPassword("");
        setSuccessMsg(
          "Paskyra su šiuo el. paštu jau yra sukurta. Jei ji dar nepatvirtinta, patvirtinimo laiškas išsiųstas dar kartą.",
        );
        return;
      }

      if (createdUser?.id) {
        const { error: upsertError } = await supabase.from("users").upsert(
          {
            id: createdUser.id,
            email: createdUser.email || email || null,
            full_name: fullName || null,
            role: "client",
          },
          { onConflict: "id" },
        );

        if (upsertError) {
          console.error(
            "users upsert after register error:",
            upsertError.message,
          );
        }
      }

      if (!data?.session) {
        setPassword("");
        setSuccessMsg(
          "Paskyra sukurta. Patikrinkite el. paštą ir paspauskite Supabase atsiųstą patvirtinimo nuorodą.",
        );
        return;
      }

      router.push("/prisijungti?next=/account");
    } catch (e) {
      console.error("register error:", e);
      setErrorMsg("Nepavyko sukurti paskyros. Bandykite dar kartą.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setErrorMsg("");
    setSuccessMsg("");
    setGoogleLoading(true);

    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/prisijungti?next=${encodeURIComponent("/account")}&mode=register`,
        },
      });
    } catch (e) {
      console.error("google auth error:", e);
      setErrorMsg("Nepavyko prisijungti su Google.");
      setGoogleLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("Įrašykite el. pašto adresą.");
      return;
    }

    setResendLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessMsg("Patvirtinimo laiškas išsiųstas dar kartą.");
    } catch (error) {
      console.error("resend confirmation error:", error);
      setErrorMsg("Nepavyko išsiųsti patvirtinimo laiško.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="heading mb-4 text-2xl font-bold text-dark">
        Sukurti paskyrą
      </h1>

      <form
        onSubmit={handleRegister}
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
      >
        <div>
          <label className="ui-font mb-1 block text-sm font-semibold text-slate-700">
            Vardas, pavardė
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="ui-font w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

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

        {successMsg && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="ui-font text-sm text-emerald-700">{successMsg}</p>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || loading || googleLoading}
              className="ui-font mt-2 text-sm font-semibold text-emerald-800 hover:text-dark disabled:text-emerald-300"
            >
              {resendLoading
                ? "Siunčiama..."
                : "Siųsti patvirtinimo laišką dar kartą"}
            </button>
          </div>
        )}

        {errorMsg && <p className="ui-font text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading || googleLoading || resendLoading}
          className="ui-font w-full rounded-xl bg-primary py-2 text-lg font-semibold text-white shadow-md hover:bg-dark disabled:bg-slate-300"
        >
          {loading ? "Kuriama..." : "Sukurti paskyrą"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogleRegister}
        disabled={loading || googleLoading || resendLoading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-lg ui-font hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <img src="/icons/google.png" alt="Google icon" className="w-5 h-5" />
        {googleLoading ? "Jungiama..." : "Tęsti su Google"}
      </button>

      <p className="ui-font mt-3 text-center text-sm text-slate-600">
        Jau turite paskyrą?{" "}
        <a href="/prisijungti" className="text-primary hover:text-dark">
          Prisijunkite
        </a>
      </p>
    </div>
  );
}
