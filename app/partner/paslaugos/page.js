"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";
import ConfirmModal from "../../components/ConfirmModal";

const BUCKET = "public-images";

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
}

function getServiceTypeLabel(type) {
  switch (type) {
    case "animator":
      return "Animatorius";
    case "cake":
      return "Tortas";
    case "decorations":
      return "Dekoracijos";
    default:
      return type || "Nenurodyta";
  }
}

function getUnitLabel(unit) {
  switch (unit) {
    case "unit":
      return "vnt.";
    case "hour":
      return "val.";
    case "booking":
      return "už rezervaciją";
    case "child":
      return "vaikui";
    case "adult":
      return "suaugusiajam";
    default:
      return unit || "";
  }
}

export default function PartnerServicesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [deletingServiceId, setDeletingServiceId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProviderData() {
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

        const { data: providerRow, error: providerError } = await supabase
          .from("service_providers")
          .select(
            "id, name, description, address, city, email, phone, website, facebook_url, instagram_url, tiktok_url, google_maps_url",
          )
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (providerError) {
          throw providerError;
        }

        if (!providerRow) {
          router.replace("/partner/onboarding/paslaugos");
          return;
        }

        setProvider(providerRow);

        const { data: serviceRows, error: servicesError } = await supabase
          .from("services")
          .select(
            `
            id,
            name,
            description,
            price_per_unit,
            units_of_measure,
            duration_minutes,
            is_listed,
            service_type,
            is_global,
            short_description,
            full_description,
            ingredients,
            includes_text,
            notes,
            venue_id,
            room_id,
            sort_order
          `,
          )
          .eq("provider_id", providerRow.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (servicesError) {
          throw servicesError;
        }

        setServices(serviceRows || []);
      } catch (error) {
        console.error("partner services load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti paslaugų informacijos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProviderData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleDeleteService() {
    if (!serviceToDelete) {
      return;
    }

    setDeletingServiceId(serviceToDelete.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: serviceImageRows, error: serviceImagesLoadError } =
        await supabase
          .from("service_images")
          .select("path")
          .eq("service_id", serviceToDelete.id);

      if (serviceImagesLoadError) throw serviceImagesLoadError;

      const { error: bookingApprovalsError } = await supabase
        .from("booking_approvals")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (bookingApprovalsError) throw bookingApprovalsError;

      const { error: bookingServicesError } = await supabase
        .from("booking_services")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (bookingServicesError) throw bookingServicesError;

      const { error: serviceImagesDeleteError } = await supabase
        .from("service_images")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (serviceImagesDeleteError) throw serviceImagesDeleteError;

      const { error: serviceDeleteError } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceToDelete.id);

      if (serviceDeleteError) throw serviceDeleteError;

      const storagePaths = (serviceImageRows || [])
        .map((item) => item.path)
        .filter(Boolean);

      if (storagePaths.length) {
        await supabase.storage.from(BUCKET).remove(storagePaths);
      }

      setServices((current) =>
        current.filter((item) => item.id !== serviceToDelete.id),
      );
      setSuccessMsg("Paslauga ištrinta.");
      setServiceToDelete(null);
    } catch (error) {
      console.error("delete service error:", error);
      setErrorMsg(
        "Nepavyko ištrinti paslaugos. Gali būti, kad jai vis dar yra susietų rezervacijų arba trūksta DB leidimų.",
      );
    } finally {
      setDeletingServiceId("");
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px] flex flex-col gap-[16px] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Paslaugų valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Mano paslaugos
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Čia valdysite paslaugų profilį ir savo siūlomas paslaugas.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            provider && router.push(`/partner/paslaugos/${provider.id}/nauja`)
          }
          className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
        >
          Pridėti naują paslaugą
        </button>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-[20px] rounded-[18px] bg-emerald-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-emerald-700">{successMsg}</p>
        </div>
      )}

      {provider && (
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="flex flex-col gap-[16px] md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="ui-font text-[24px] font-semibold text-slate-900">
                {provider.name}
              </h2>

              {(provider.address || provider.city) && (
                <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                  {provider.address || ""}
                  {provider.address && provider.city ? ", " : ""}
                  {provider.city || ""}
                </p>
              )}

              {provider.description && (
                <p className="mt-[12px] ui-font max-w-[760px] text-[14px] leading-[22px] text-slate-600">
                  {provider.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-[20px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">El. paštas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {provider.email || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Telefonas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {provider.phone || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Svetainė</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.website || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Facebook</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.facebook_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Instagram</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.instagram_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">TikTok</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.tiktok_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px] md:col-span-2 xl:col-span-3">
              <p className="ui-font text-[12px] text-slate-500">Google Maps</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.google_maps_url || "-"}
              </p>
            </div>
          </div>

          <div className="mt-[20px] flex flex-col gap-[10px] sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/partner/paslaugu-uzklausos")}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Peržiūrėti paslaugų užklausas
            </button>
          </div>
        </section>
      )}

      <section className="mt-[24px]">
        <div className="mb-[16px] flex items-center justify-between">
          <h2 className="ui-font text-[24px] font-semibold text-slate-900">
            Paslaugos
          </h2>
          <span className="ui-font text-[14px] text-slate-500">
            Iš viso: {services.length}
          </span>
        </div>

        {services.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[32px] text-center">
            <p className="ui-font text-[16px] font-semibold text-slate-800">
              Paslaugų dar nėra
            </p>
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Sukurkite pirmą arba papildomą paslaugą savo profiliui.
            </p>

            <button
              type="button"
              onClick={() =>
                provider &&
                router.push(`/partner/paslaugos/${provider.id}/nauja`)
              }
              className="ui-font mt-[16px] inline-flex h-[48px] items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark"
            >
              Pridėti paslaugą
            </button>
          </div>
        ) : (
          <div className="grid gap-[16px] lg:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.id}
                className="rounded-[24px] bg-white p-[20px] shadow-sm"
              >
                <div className="flex items-start justify-between gap-[12px]">
                  <div>
                    <h3 className="ui-font text-[20px] font-semibold text-slate-900">
                      {service.name}
                    </h3>

                    {service.short_description && (
                      <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
                        {service.short_description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-[18px] grid gap-[10px] sm:grid-cols-2">
                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Tipas</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {getServiceTypeLabel(service.service_type)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Kaina</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {formatPrice(service.price_per_unit)}{" "}
                      {getUnitLabel(service.units_of_measure)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Trukmė</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {service.duration_minutes
                        ? `${service.duration_minutes} min.`
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Matomumas
                    </p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {service.is_global ? "Bendras katalogas" : "Vietinė"}
                    </p>
                  </div>
                </div>

                {service.includes_text && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Kas įskaičiuota
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.includes_text}
                    </p>
                  </div>
                )}

                {service.service_type === "cake" && service.ingredients && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Ingredientai
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.ingredients}
                    </p>
                  </div>
                )}

                {service.notes && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Pastabos
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.notes}
                    </p>
                  </div>
                )}

                <div className="mt-[18px] flex flex-col gap-[10px] sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/partner/paslaugos/${service.id}`)
                    }
                    className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                  >
                    Valdyti paslaugą
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/partner/paslaugos/${service.id}/nuotraukos`)
                    }
                    className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Nuotraukos
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceToDelete(service)}
                    disabled={deletingServiceId === service.id}
                    className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-red-200 bg-red-50 px-[16px] text-[14px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingServiceId === service.id ? "Trinama..." : "Ištrinti"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(serviceToDelete)}
        title="Ištrinti paslaugą?"
        message={`Paslauga "${serviceToDelete?.name || ""}" bus pašalinta. Ar tikrai norite tęsti?`}
        confirmLabel="Taip, ištrinti"
        cancelLabel="Ne, palikti"
        loading={Boolean(deletingServiceId)}
        onCancel={() => setServiceToDelete(null)}
        onConfirm={handleDeleteService}
      />
    </main>
  );
}
