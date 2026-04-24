"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setErrorMsg("");
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

      if (createdUser?.id) {
        const { error: upsertError } = await supabase.from("users").upsert(
          {
            id: createdUser.id,
            email: createdUser.email || email || null,
            full_name: fullName || null,
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

      router.push("/prisijungti?next=/paskyros-tipas");
    } catch (e) {
      console.error("register error:", e);
      setErrorMsg("Nepavyko sukurti paskyros. Bandykite dar kartą.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setErrorMsg("");
    setGoogleLoading(true);

    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/prisijungti?next=${encodeURIComponent("/paskyros-tipas")}`,
        },
      });
    } catch (e) {
      console.error("google auth error:", e);
      setErrorMsg("Nepavyko prisijungti su Google.");
      setGoogleLoading(false);
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

        {errorMsg && <p className="ui-font text-sm text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="ui-font w-full rounded-xl bg-primary py-2 text-lg font-semibold text-white shadow-md hover:bg-dark disabled:bg-slate-300"
        >
          {loading ? "Kuriama..." : "Sukurti paskyrą"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogleRegister}
        disabled={loading || googleLoading}
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
