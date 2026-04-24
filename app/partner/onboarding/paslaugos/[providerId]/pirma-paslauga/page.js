"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Loader from "@/app/components/Loader";

const BUCKET = "public-images";

const serviceTypeOptions = [
  { value: "animator", label: "Animatorius" },
  { value: "cake", label: "Tortas" },
  { value: "decorations", label: "Dekoracijos" },
];

const unitOptions = [
  { value: "unit", label: "vnt." },
  { value: "hour", label: "val." },
  { value: "booking", label: "uz rezervacija" },
  { value: "child", label: "vaikui" },
  { value: "adult", label: "suaugusiam" },
];

const weekdays = [
  { value: 1, label: "Pirmadienis", shortLabel: "Pr" },
  { value: 2, label: "Antradienis", shortLabel: "An" },
  { value: 3, label: "Treciadienis", shortLabel: "Tr" },
  { value: 4, label: "Ketvirtadienis", shortLabel: "Kt" },
  { value: 5, label: "Penktadienis", shortLabel: "Pn" },
  { value: 6, label: "Sestadienis", shortLabel: "St" },
  { value: 0, label: "Sekmadienis", shortLabel: "Sk" },
];

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

function getReadableError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.error_description) {
    return error.error_description;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackMessage;
  }
}

function createStepError(stepLabel, error) {
  const baseMessage = getReadableError(
    error,
    `${stepLabel}: ivyko nenumatyta klaida.`,
  );

  return new Error(`${stepLabel}: ${baseMessage}`);
}

export default function FirstServiceOnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const providerId = params?.providerId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [provider, setProvider] = useState(null);

  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("animator");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [unitsOfMeasure, setUnitsOfMeasure] = useState("unit");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [includesText, setIncludesText] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [photoFiles, setPhotoFiles] = useState([]);

  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photoFiles],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [photoPreviews]);

  useEffect(() => {
    let isMounted = true;

    async function validateAccess() {
      if (!providerId) {
        router.replace("/partner");
        return;
      }

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

      const { data: providerRow, error: providerError } = await supabase
        .from("service_providers")
        .select("id, name, city, owner_id")
        .eq("id", providerId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (providerError) {
        console.error("provider access error:", providerError.message);
      }

      if (!providerRow) {
        router.replace("/partner");
        return;
      }

      const { data: availabilityRows } = await supabase
        .from("service_provider_availability")
        .select("weekday, start_time, end_time")
        .eq("provider_id", providerId)
        .order("weekday", { ascending: true });

      if (!isMounted) return;

      if (availabilityRows?.length) {
        setSelectedDays(availabilityRows.map((item) => item.weekday));
        setOpenTime(String(availabilityRows[0].start_time || "").slice(0, 5));
        setCloseTime(String(availabilityRows[0].end_time || "").slice(0, 5));
      }

      setProvider(providerRow);
      setLoading(false);
    }

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [router, providerId]);

  function toggleDay(dayValue) {
    setSelectedDays((current) =>
      current.includes(dayValue)
        ? current.filter((value) => value !== dayValue)
        : [...current, dayValue].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Iveskite paslaugos pavadinima.");
      return;
    }

    if (!serviceType) {
      setErrorMsg("Pasirinkite paslaugos tipa.");
      return;
    }

    if (pricePerUnit === "" || Number(pricePerUnit) < 0) {
      setErrorMsg("Iveskite teisinga kaina.");
      return;
    }

    if (!selectedDays.length) {
      setErrorMsg("Pasirinkite bent viena darbo diena.");
      return;
    }

    if (!openTime || !closeTime || openTime >= closeTime) {
      setErrorMsg("Nurodykite teisinga paslaugu laika.");
      return;
    }

    setSubmitting(true);

    const serviceId = crypto.randomUUID();
    const uploadedPaths = [];

    try {
      const payload = {
        id: serviceId,
        provider_id: providerId,
        name: name.trim(),
        description: fullDescription.trim() || shortDescription.trim() || null,
        price_per_unit: Number(pricePerUnit),
        units_of_measure: unitsOfMeasure,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        is_listed: true,
        service_type: serviceType,
        is_global: true,
        short_description: shortDescription.trim() || null,
        full_description: fullDescription.trim() || null,
        ingredients: serviceType === "cake" ? ingredients.trim() || null : null,
        includes_text: includesText.trim() || null,
        notes: notes.trim() || null,
      };

      const { error: insertError } = await supabase.from("services").insert(payload);

      if (insertError) {
        throw createStepError("Nepavyko issaugoti paslaugos", insertError);
      }

      const { error: deleteAvailabilityError } = await supabase
        .from("service_provider_availability")
        .delete()
        .eq("provider_id", providerId);

      if (deleteAvailabilityError) {
        throw createStepError(
          "Nepavyko atnaujinti paslaugos grafiko",
          deleteAvailabilityError,
        );
      }

      const availabilityRows = selectedDays.map((weekday) => ({
        provider_id: providerId,
        weekday,
        start_time: openTime,
        end_time: closeTime,
      }));

      const { error: availabilityError } = await supabase
        .from("service_provider_availability")
        .insert(availabilityRows);

      if (availabilityError) {
        throw createStepError(
          "Nepavyko issaugoti paslaugos laisvumo",
          availabilityError,
        );
      }

      for (let index = 0; index < photoFiles.length; index += 1) {
        const file = photoFiles[index];
        const path = `services/${providerId}/${serviceId}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw createStepError("Nepavyko ikelti paslaugos nuotraukos", uploadError);
        }

        uploadedPaths.push(path);
      }

      if (uploadedPaths.length) {
        const imageRows = uploadedPaths.map((path, index) => ({
          service_id: serviceId,
          path,
          alt_text: name.trim() || null,
          is_primary: index === 0,
          position: index,
        }));

        const { error: serviceImagesError } = await supabase
          .from("service_images")
          .insert(imageRows);

        if (serviceImagesError) {
          throw createStepError(
            "Nepavyko issaugoti paslaugos nuotrauku irasu",
            serviceImagesError,
          );
        }
      }

      router.push("/partner");
    } catch (e) {
      console.error("create first service error:", {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        statusCode: e?.statusCode,
        raw: e,
      });

      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
      }

      await supabase.from("service_images").delete().eq("service_id", serviceId);
      await supabase.from("services").delete().eq("id", serviceId);

      setErrorMsg(
        getReadableError(e, "Nepavyko sukurti paslaugos. Bandykite dar karta."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[980px] px-[16px] py-[40px]">
      <div className="mb-[24px]">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Paslaugu teikejo onboarding
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Pridekite pirma paslauga
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Sukurkite pirma pasiulyma su kaina, darbo laiku ir nuotraukomis, kad
          ji butu galima rodyti rezervacijos sraute.
        </p>
        {provider && (
          <p className="mt-[8px] ui-font text-[14px] text-slate-500">
            Profilis: <span className="font-semibold">{provider.name}</span>
          </p>
        )}
      </div>

      <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
        {errorMsg && (
          <div className="mb-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px]">
            <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-[20px]">
          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Paslaugos pavadinimas
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              placeholder="Pvz. Linksmas animatorius 2 val."
            />
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Paslaugos tipas
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              >
                {serviceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Trukme minutemis
              </label>
              <input
                type="number"
                min="0"
                step="15"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="120"
              />
            </div>
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">Kaina</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="80"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Kainos vienetas
              </label>
              <select
                value={unitsOfMeasure}
                onChange={(e) => setUnitsOfMeasure(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              >
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-[18px] bg-slate-50 p-[14px]">
            <p className="ui-font mb-[12px] text-[14px] font-semibold text-slate-800">
              Paslaugu laisvumas
            </p>

            <div className="flex flex-wrap gap-[10px]">
              {weekdays.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`ui-font inline-flex h-[42px] items-center justify-center rounded-full border px-[16px] text-[14px] font-medium transition ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary"
                    }`}
                  >
                    {day.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="mt-[12px] grid gap-[12px] md:grid-cols-2">
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              />

              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <p className="ui-font mt-[10px] text-[12px] leading-[20px] text-slate-500">
              Sis grafikas taikomas visoms sio teikejo paslaugoms.
            </p>
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Trumpas aprasymas
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={3}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Trumpas paslaugos pristatymas katalogui."
            />
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Pilnas aprasymas
            </label>
            <textarea
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              rows={5}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Detalesnis paslaugos aprasymas."
            />
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Kas iskaiciuota
            </label>
            <textarea
              value={includesText}
              onChange={(e) => setIncludesText(e.target.value)}
              rows={3}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Pvz. rekvizitai, atvykimas, vedimas, muzika..."
            />
          </div>

          {serviceType === "cake" && (
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Ingredientai
              </label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={3}
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
                placeholder="Pvz. sudetis, alergenai, skoniai..."
              />
            </div>
          )}

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">Pastabos</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Papildoma svarbi informacija."
            />
          </div>

          <div className="space-y-[10px]">
            <label className="ui-font text-[13px] text-slate-600">
              Nuotraukos
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
            />

            {photoPreviews.length > 0 && (
              <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
                {photoPreviews.map((item) => (
                  <div
                    key={item.url}
                    className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50"
                  >
                    <Image
                      src={item.url}
                      alt={item.name}
                      width={800}
                      height={500}
                      unoptimized
                      className="h-[180px] w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Saugoma..." : "Sukurti pirma paslauga"}
          </button>
        </form>
      </section>
    </main>
  );
}
