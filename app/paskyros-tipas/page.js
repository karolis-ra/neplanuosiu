"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useEffect, useState } from "react";
import Loader from "../components/Loader";

const accountTypes = [
  {
    id: "client",
    title: "Klientas",
    description:
      "Ieškokite žaidimų kambarių, rinkitės papildomas paslaugas ir teikite rezervacijos užklausas.",
    buttonLabel: "Tęsti kaip klientui",
  },
  {
    id: "venue_owner",
    title: "Venue owner",
    description:
      "Talpinkite savo venue, kambarius, valdykite rezervacijų užklausas ir siūlykite papildomas paslaugas.",
    buttonLabel: "Tęsti kaip venue owner",
  },
  {
    id: "service_provider",
    title: "Paslaugų teikėjas",
    description:
      "Kurti savo paslaugas, valdyti darbo laiką ir tvirtinti su paslaugomis susijusias užklausas.",
    buttonLabel: "Tęsti kaip paslaugų teikėjui",
  },
];

export default function AccountTypePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkUser() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError) {
        console.error("auth error:", userError.message);
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      setLoading(false);
    }

    checkUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function saveUserRole(user, role) {
    const basePayload = {
      id: user.id,
      email: user.email || null,
      full_name: user.user_metadata?.full_name || null,
      role,
    };

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    if (existingUser?.id) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          email: basePayload.email,
          full_name: basePayload.full_name,
          role: basePayload.role,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase
      .from("users")
      .insert(basePayload);

    if (insertError) {
      throw insertError;
    }
  }

  async function handleSelect(type) {
    setSavingType(type);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      await saveUserRole(user, type);

      if (type === "client") {
        router.push("/account");
        return;
      }

      if (type === "venue_owner") {
        router.push("/partner/onboarding/venue");
        return;
      }

      if (type === "service_provider") {
        router.push("/partner/onboarding/paslaugos");
        return;
      }

      router.push("/");
    } catch (e) {
      console.error("account type save error:", e);
      setError(
        e?.message || "Nepavyko išsaugoti paskyros tipo. Bandykite dar kartą.",
      );
      setSavingType("");
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mx-auto max-w-[760px] text-center">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Paskyros tipas
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Pasirinkite, kaip norite naudotis platforma
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Šį pasirinkimą vėliau galėsime plėsti ir pritaikyti pagal jūsų rolę.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-[24px] max-w-[760px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{error}</p>
        </div>
      )}

      <section className="mx-auto mt-[28px] grid max-w-[1100px] gap-[20px] md:grid-cols-3">
        {accountTypes.map((item) => {
          const isSaving = savingType === item.id;

          return (
            <article
              key={item.id}
              className="flex h-full flex-col rounded-[28px] bg-white p-[24px] shadow-sm"
            >
              <h2 className="ui-font text-[22px] font-semibold text-slate-900">
                {item.title}
              </h2>

              <p className="mt-[12px] ui-font text-[14px] leading-[22px] text-slate-600">
                {item.description}
              </p>

              <button
                type="button"
                onClick={() => handleSelect(item.id)}
                disabled={Boolean(savingType)}
                className="ui-font mt-auto inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? "Saugoma..." : item.buttonLabel}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}
