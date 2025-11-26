"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

async function handleGoogleLogin() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin, // po login'o grįš į tavo puslapį
    },
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

    // prisijungė sėkmingai
    router.push("/"); // arba /paieska, arba kur tu nori
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="heading mb-4 text-2xl font-bold text-dark">Prisijungti</h1>

      <form
        onSubmit={handleLogin}
        className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"
      >
        <div>
          <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
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
          <label className="ui-font mb-1 block text-xs font-semibold text-slate-700">
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

        {errorMsg && <p className="ui-font text-xs text-red-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="ui-font w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white shadow-md hover:bg-dark disabled:bg-slate-300"
        >
          {loading ? "Jungiama..." : "Prisijungti"}
        </button>
      </form>

      <p className="ui-font mt-3 text-center text-xs text-slate-600">
        Neturite paskyros?{" "}
        <a href="/registracija" className="text-primary hover:text-dark">
          Sukurti paskyrą
        </a>
      </p>
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full rounded-xl border border-slate-200 py-2 text-sm ui-font hover:bg-slate-50"
      >
        Prisijungti su Google
      </button>
    </div>
  );
}
