"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Loader from "@/app/components/Loader";
import SelectControl from "@/app/components/SelectControl";

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

function createDefaultWeeklyAvailability() {
  return weekdays.map((day) => ({
    weekday: day.value,
    enabled: [1, 2, 3, 4, 5].includes(day.value),
    startTime: "09:00",
    endTime: "18:00",
  }));
}

function buildWeeklyAvailability(rows = []) {
  return createDefaultWeeklyAvailability().map((day) => {
    const row = rows.find((item) => item.weekday === day.weekday);

    return row
      ? {
          ...day,
          enabled: true,
          startTime: String(row.start_time || "").slice(0, 5) || day.startTime,
          endTime: String(row.end_time || "").slice(0, 5) || day.endTime,
        }
      : day;
  });
}

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

export default function CreateServicePage() {
  const router = useRouter();
  const params = useParams();
  const providerId = params?.providerId || params?.privderId;

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
  const [isGlobal, setIsGlobal] = useState(true);
  const [weeklyAvailability, setWeeklyAvailability] = useState(
    createDefaultWeeklyAvailability,
  );
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
        router.replace("/partner/paslaugos");
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
        router.replace("/partner/paslaugos");
        return;
      }

      const { data: availabilityRows } = await supabase
        .from("service_provider_availability")
        .select("weekday, start_time, end_time")
        .eq("provider_id", providerId)
        .order("weekday", { ascending: true });

      if (!isMounted) return;

      if (availabilityRows?.length) {
        setWeeklyAvailability(buildWeeklyAvailability(availabilityRows));
      }

      setProvider(providerRow);
      setLoading(false);
    }

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [router, providerId]);

  function updateAvailabilityDay(dayValue, field, value) {
    setWeeklyAvailability((current) =>
      current.map((item) =>
        item.weekday === dayValue ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Įveskite paslaugos pavadinimą.");
      return;
    }

    if (!serviceType) {
      setErrorMsg("Pasirinkite paslaugos tipa.");
      return;
    }

    if (pricePerUnit === "" || Number(pricePerUnit) < 0) {
      setErrorMsg("Įveskite teisingą kainą.");
      return;
    }

    if (durationMinutes && Number(durationMinutes) < 0) {
      setErrorMsg("Trukmė negali buti neigiama.");
      return;
    }

    const enabledAvailability = weeklyAvailability.filter((item) => item.enabled);

    if (!enabledAvailability.length) {
      setErrorMsg("Pasirinkite bent viena darbo diena.");
      return;
    }

    if (
      enabledAvailability.some(
        (item) => !item.startTime || !item.endTime || item.startTime >= item.endTime,
      )
    ) {
      setErrorMsg("Nurodykite teisingą paslaugų laiką.");
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
        is_global: isGlobal,
        short_description: shortDescription.trim() || null,
        full_description: fullDescription.trim() || null,
        ingredients: serviceType === "cake" ? ingredients.trim() || null : null,
        includes_text: includesText.trim() || null,
        notes: notes.trim() || null,
      };

      const { error: insertError } = await supabase
        .from("services")
        .insert(payload);

      if (insertError) {
        throw createStepError("Nepavyko išsaugoti paslaugos", insertError);
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

      const availabilityRows = enabledAvailability.map((item) => ({
        provider_id: providerId,
        weekday: item.weekday,
        start_time: item.startTime,
        end_time: item.endTime,
      }));

      const { error: availabilityError } = await supabase
        .from("service_provider_availability")
        .insert(availabilityRows);

      if (availabilityError) {
        throw createStepError(
          "Nepavyko išsaugoti paslaugos laisvumo",
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
          throw createStepError(
            "Nepavyko ikelti paslaugos nuotraukos",
            uploadError,
          );
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
            "Nepavyko išsaugoti paslaugos nuotraukų įrašų",
            serviceImagesError,
          );
        }
      }

      router.push("/partner/paslaugos");
    } catch (e) {
      console.error("create service error:", {
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

      await supabase
        .from("service_images")
        .delete()
        .eq("service_id", serviceId);
      await supabase.from("services").delete().eq("id", serviceId);

      setErrorMsg(
        getReadableError(e, "Nepavyko sukurti paslaugos. Bandykite dar kartą."),
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
          Nauja paslauga
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Sukurkite naują paslaugą
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Užpildykite pagrindinę informaciją, darbo laiką ir nuotraukas taip,
          kad paslauga galėtų būti suderinta su kambario rezervacijos laiku.
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
              placeholder="Pvz. Animatorius 2 valandoms"
            />
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Paslaugos tipas
              </label>
              <SelectControl
                value={serviceType}
                onChange={setServiceType}
                options={serviceTypeOptions}
                buttonClassName="h-[48px]"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Trukmė minutemis
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
              <label className="ui-font text-[13px] text-slate-600">
                Kaina
              </label>
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
                Kaina už
              </label>
              <SelectControl
                value={unitsOfMeasure}
                onChange={setUnitsOfMeasure}
                options={unitOptions}
                buttonClassName="h-[48px]"
              />
            </div>
          </div>

          <div className="rounded-[18px] bg-slate-50 p-[14px]">
            <label className="flex items-start gap-[10px]">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="mt-[2px] h-[16px] w-[16px]"
              />
              <span className="ui-font text-[14px] leading-[22px] text-slate-700">
                Rodyti bendrame kataloge
              </span>
            </label>
          </div>

          <div className="rounded-[18px] bg-slate-50 p-[14px]">
            <p className="ui-font mb-[12px] text-[14px] font-semibold text-slate-800">
              Darbo laikas
            </p>

            <div className="space-y-[10px]">
              {weekdays.map((day) => {
                const value = weeklyAvailability.find(
                  (item) => item.weekday === day.value,
                );

                return (
                  <div
                    key={day.value}
                    className="grid gap-[10px] rounded-[16px] bg-white p-[10px] md:grid-cols-[1fr_150px_150px]"
                  >
                    <label className="flex items-center gap-[10px]">
                      <input
                        type="checkbox"
                        checked={Boolean(value?.enabled)}
                        onChange={(event) =>
                          updateAvailabilityDay(
                            day.value,
                            "enabled",
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="ui-font text-[14px] font-semibold text-slate-700">
                        {day.label}
                      </span>
                    </label>

                    <input
                      type="time"
                      value={value?.startTime || "09:00"}
                      disabled={!value?.enabled}
                      onChange={(event) =>
                        updateAvailabilityDay(day.value, "startTime", event.target.value)
                      }
                      className="ui-font h-[44px] rounded-[14px] border border-slate-200 bg-white px-[12px] text-[14px] outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
                    />

                    <input
                      type="time"
                      value={value?.endTime || "18:00"}
                      disabled={!value?.enabled}
                      onChange={(event) =>
                        updateAvailabilityDay(day.value, "endTime", event.target.value)
                      }
                      className="ui-font h-[44px] rounded-[14px] border border-slate-200 bg-white px-[12px] text-[14px] outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                );
              })}
            </div>

            <p className="ui-font mt-[10px] text-[12px] leading-[20px] text-slate-500">
              Šis grafikas taikomas visoms šio paslaugų teikėjo paslaugoms, nes
              rezervacijoje naudojamas bendras teikejo uzimtumas.
            </p>
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Trumpas aprašymas
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
              Pilnas aprašymas
            </label>
            <textarea
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              rows={5}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Detalesnis paslaugos aprašymas."
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
              placeholder="Pvz. atvykimas, rekvizitai, vedimas..."
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
            <label className="ui-font text-[13px] text-slate-600">
              Pastabos
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Papildoma svarbi informacija apie paslauga."
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

          <div className="flex flex-col gap-[10px] sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/partner/paslaugos")}
              className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Atšaukti
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="ui-font inline-flex h-[50px] flex-1 items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Saugoma..." : "Sukurti paslaugą"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
