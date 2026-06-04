"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Loader from "../../../components/Loader";

const PARTNER_ROLE = "venue_owner";

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function isExistingAuthUser(user) {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export default function PartnerInvitePage() {
  const { token } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInvite() {
      const { data, error } = await supabase
        .from("partner_invites")
        .select(
          `
          id,
          token,
          email,
          status,
          expires_at,
          request:partner_requests (
            business_name,
            contact_name
          )
        `,
        )
        .eq("token", token)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("partner invite load error:", error.message);
      }

      setInvite(data || null);
      setFullName(data?.request?.contact_name || "");
      setLoading(false);
    }

    loadInvite();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!invite || invite.status !== "pending" || isExpired(invite.expires_at)) {
      setErrorMsg("Kvietimo nuoroda nebegalioja.");
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg("Įrašykite vardą ir pavardę.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Slaptažodį turi sudaryti bent 6 simboliai.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            partner_invite_token: invite.token,
          },
        },
      });

      if (error) throw error;

      const user = data?.user;

      if (isExistingAuthUser(user)) {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email: invite.email,
        });

        if (resendError) {
          console.warn(
            "partner signup confirmation resend warning:",
            resendError,
          );
        }

        setPassword("");
        setSuccessMsg(
          "Paskyra su šiuo el. paštu jau yra sukurta. Jei ji dar nepatvirtinta, patvirtinimo laiškas išsiųstas dar kartą.",
        );
        return;
      }

      if (user?.id) {
        const { error: userUpsertError } = await supabase.from("users").upsert(
          {
            id: user.id,
            email: invite.email,
            full_name: fullName.trim(),
            role: PARTNER_ROLE,
          },
          { onConflict: "id" },
        );

        if (userUpsertError) throw userUpsertError;

        const { error: inviteUpdateError } = await supabase
          .from("partner_invites")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            accepted_user_id: user.id,
          })
          .eq("id", invite.id);

        if (inviteUpdateError) throw inviteUpdateError;
      }

      if (!data?.session) {
        setPassword("");
        setSuccessMsg(
          "Partnerio paskyra sukurta. Patikrinkite el. paštą ir patvirtinkite registraciją per Supabase atsiųstą nuorodą.",
        );
        return;
      }

      router.push("/prisijungti?next=/partner");
    } catch (error) {
      console.error("partner invite signup error:", error);
      setErrorMsg(
        error?.message ||
          "Nepavyko sukurti partnerio paskyros. Bandykite dar kartą.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    if (!invite?.email) return;

    setErrorMsg("");
    setSuccessMsg("");
    setResendLoading(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: invite.email,
      });

      if (error) throw error;

      setSuccessMsg("Patvirtinimo laiškas išsiųstas dar kartą.");
    } catch (error) {
      console.error("partner invite resend confirmation error:", error);
      setErrorMsg(
        error?.message || "Nepavyko išsiųsti patvirtinimo laiško dar kartą.",
      );
    } finally {
      setResendLoading(false);
    }
  }

  if (loading) return <Loader message="Tikriname kvietimą..." />;

  const invalidInvite =
    !invite || invite.status !== "pending" || isExpired(invite.expires_at);

  if (invalidInvite) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[680px] items-center px-4 py-12">
        <section className="rounded-[28px] bg-white p-8 text-center shadow-sm">
          <h1 className="heading text-3xl font-bold text-slate-900">
            Kvietimo nuoroda nebegalioja
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Susisiekite su administratoriumi, kad gautumėte naują partnerio
            paskyros kvietimą.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[520px] items-center px-4 py-12">
      <section className="w-full rounded-[28px] bg-white p-6 shadow-sm">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Partnerio kvietimas
        </p>
        <h1 className="mt-2 heading text-3xl font-bold text-slate-900">
          Sukurkite partnerio paskyrą
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Kvietimas skirtas el. paštui <strong>{invite.email}</strong>.
        </p>

        {errorMsg && (
          <div className="mt-4 rounded-[16px] bg-red-50 px-4 py-3">
            <p className="ui-font text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 rounded-[16px] bg-emerald-50 px-4 py-3">
            <p className="ui-font text-sm text-emerald-700">{successMsg}</p>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || submitting}
              className="ui-font mt-2 text-sm font-semibold text-emerald-800 hover:text-dark disabled:text-emerald-300"
            >
              {resendLoading
                ? "Siunčiama..."
                : "Siųsti patvirtinimo laišką dar kartą"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="ui-font text-sm font-semibold text-slate-600">
              Vardas ir pavardė
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="ui-font text-sm font-semibold text-slate-600">
              Slaptažodis
            </span>
            <input
              type="password"
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || resendLoading}
            className="ui-font inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-primary px-5 text-sm font-semibold text-white shadow-md hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Kuriama..." : "Sukurti partnerio paskyrą"}
          </button>
        </form>
      </section>
    </main>
  );
}
