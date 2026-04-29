"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import Loader from "../components/Loader";
import ResponsiveImageFrame from "../components/ResponsiveImageFrame";

const BUCKET = "public-images";

function getPublicUrl(path) {
  if (!path) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

function pickPrimaryImage(images) {
  if (!images?.length) return null;

  return [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.position ?? 9999) - (b.position ?? 9999);
  })[0];
}

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

        let venueCoverUrl = null;

        if (venueRow?.id) {
          const { data: venueImages, error: venueImagesError } = await supabase
            .from("images")
            .select("path, is_cover, is_primary, position")
            .eq("venue_id", venueRow.id)
            .is("room_id", null);

          if (venueImagesError) {
            console.error("venue image fetch error:", venueImagesError.message);
          }

          venueCoverUrl = getPublicUrl(pickPrimaryImage(venueImages)?.path);
        }

        setVenue(venueRow ? { ...venueRow, coverUrl: venueCoverUrl } : null);

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

        let providerImageUrl = null;

        if (providerRow?.id) {
          const { data: serviceRows, error: servicesError } = await supabase
            .from("services")
            .select("id")
            .eq("provider_id", providerRow.id);

          if (servicesError) {
            console.error("provider services fetch error:", servicesError.message);
          }

          const serviceIds = (serviceRows || []).map((service) => service.id);

          if (serviceIds.length) {
            const { data: serviceImages, error: serviceImagesError } =
              await supabase
                .from("service_images")
                .select("path, is_primary, position")
                .in("service_id", serviceIds);

            if (serviceImagesError) {
              console.error(
                "provider service image fetch error:",
                serviceImagesError.message,
              );
            }

            providerImageUrl = getPublicUrl(pickPrimaryImage(serviceImages)?.path);
          }
        }

        setServiceProvider(
          providerRow ? { ...providerRow, coverUrl: providerImageUrl } : null,
        );
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
          <ResponsiveImageFrame
            src={venue?.coverUrl}
            alt={venue?.name || "Žaidimų erdvė"}
            ratio="16 / 7"
            className="mb-[20px] rounded-[22px]"
            placeholder="Žaidimų erdvės nuotrauka"
          />

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
                  Rezervacijos
                </button>
              </>
            )}
          </div>
        </article>

        <article className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <ResponsiveImageFrame
            src={serviceProvider?.coverUrl}
            alt={serviceProvider?.name || "Paslaugos"}
            ratio="16 / 7"
            className="mb-[20px] rounded-[22px]"
            placeholder="Paslaugos nuotrauka"
          />

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
                  onClick={() => router.push("/partner/rezervacijos")}
                  className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Rezervacijos
                </button>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
