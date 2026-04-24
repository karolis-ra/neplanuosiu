"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import Loader from "../components/Loader";

export default function PartnerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [venue, setVenue] = useState(null);
  const [serviceProvider, setServiceProvider] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPartnerData() {
      try {
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
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (userError) {
          console.error("user role error:", userError.message);
        }

        const currentRole = userRow?.role || "";

        if (!currentRole || currentRole === "client") {
          router.replace("/paskyros-tipas");
          return;
        }

        const { data: venueRow, error: venueError } = await supabase
          .from("venues")
          .select("id, name, city")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (venueError) {
          console.error("venue fetch error:", venueError.message);
        }

        setVenue(venueRow || null);

        const { data: providerRow, error: providerError } = await supabase
          .from("service_providers")
          .select("id, name, city")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (providerError) {
          console.error("provider fetch error:", providerError.message);
        }

        setServiceProvider(providerRow || null);
      } catch (error) {
        console.error("partner page load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti partnerio paskyros.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPartnerData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px]">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Partnerio zona
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Partnerio valdymas
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Čia valdysite savo erdves, paslaugas ir rezervacijų užklausas.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      <section className="grid gap-[20px] md:grid-cols-2">
        <article className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div>
            <h2 className="ui-font text-[22px] font-semibold text-slate-900">
              Žaidimų erdvė
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              Valdykite žaidimų erdvės informaciją, kambarius ir su jais
              susijusias užklausas.
            </p>
          </div>

          {venue ? (
            <div className="mt-[18px] rounded-[20px] bg-slate-50 p-[16px]">
              <p className="ui-font text-[16px] font-semibold text-slate-900">
                {venue.name}
              </p>
              <p className="mt-[4px] ui-font text-[13px] text-slate-500">
                {venue.city || "Miestas nenurodytas"}
              </p>
            </div>
          ) : (
            <div className="mt-[18px] rounded-[20px] bg-slate-50 p-[16px]">
              <p className="ui-font text-[14px] leading-[22px] text-slate-600">
                Dar nesukūrėte žaidimų erdvės profilio.
              </p>
            </div>
          )}

          <div className="mt-[18px] flex flex-col gap-[12px]">
            {!venue ? (
              <button
                type="button"
                onClick={() => router.push("/partner/onboarding/venue")}
                className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
              >
                Kurti žaidimų erdvę
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/partner/venue")}
                  className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
                >
                  Valdyti žaidimų erdvę
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/partner/rezervacijos")}
                  className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Peržiūrėti rezervacijas
                </button>
              </>
            )}
          </div>
        </article>

        <article className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div>
            <h2 className="ui-font text-[22px] font-semibold text-slate-900">
              Paslaugos
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              Valdykite papildomas paslaugas, jų prieinamumą ir užklausas.
            </p>
          </div>

          {serviceProvider ? (
            <div className="mt-[18px] rounded-[20px] bg-slate-50 p-[16px]">
              <p className="ui-font text-[16px] font-semibold text-slate-900">
                {serviceProvider.name}
              </p>
              <p className="mt-[4px] ui-font text-[13px] text-slate-500">
                {serviceProvider.city || "Miestas nenurodytas"}
              </p>
            </div>
          ) : (
            <div className="mt-[18px] rounded-[20px] bg-slate-50 p-[16px]">
              <p className="ui-font text-[14px] leading-[22px] text-slate-600">
                Dar nesukūrėte paslaugų teikėjo profilio.
              </p>
            </div>
          )}

          <div className="mt-[18px] flex flex-col gap-[12px]">
            {!serviceProvider ? (
              <button
                type="button"
                onClick={() => router.push("/partner/onboarding/paslaugos")}
                className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
              >
                Kurti paslaugų profilį
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/partner/paslaugos")}
                  className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
                >
                  Valdyti paslaugas
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/partner/paslaugu-uzklausos")}
                  className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Peržiūrėti užklausas
                </button>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
