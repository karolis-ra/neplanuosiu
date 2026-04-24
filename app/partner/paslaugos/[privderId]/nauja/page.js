"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import Loader from "../../../../../components/Loader";

const serviceTypeOptions = [
  { value: "animator", label: "Animatorius" },
  { value: "cake", label: "Tortas" },
  { value: "decorations", label: "Dekoracijos" },
];

const unitOptions = [
  { value: "unit", label: "vnt." },
  { value: "hour", label: "val." },
  { value: "booking", label: "už rezervaciją" },
  { value: "child", label: "vaikui" },
  { value: "adult", label: "suaugusiam" },
];

export default function CreateServicePage() {
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
  const [isGlobal, setIsGlobal] = useState(true);

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

      setProvider(providerRow);
      setLoading(false);
    }

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [router, providerId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Įveskite paslaugos pavadinimą.");
      return;
    }

    if (!serviceType) {
      setErrorMsg("Pasirinkite paslaugos tipą.");
      return;
    }

    if (pricePerUnit === "" || Number(pricePerUnit) < 0) {
      setErrorMsg("Įveskite teisingą kainą.");
      return;
    }

    if (durationMinutes && Number(durationMinutes) < 0) {
      setErrorMsg("Trukmė negali būti neigiama.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        provider_id: providerId,
        name: name.trim(),
        description: fullDescription.trim() || shortDescription.trim() || null,
        price_per_unit: Number(pricePerUnit),
        units_of_measure: unitsOfMeasure,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        is_listed: false,
        service_type: serviceType,
        is_global: isGlobal,
        short_description: shortDescription.trim() || null,
        full_description: fullDescription.trim() || null,
        ingredients: serviceType === "cake" ? ingredients.trim() || null : null,
        includes_text: includesText.trim() || null,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from("services").insert(payload);

      if (error) {
        throw error;
      }

      router.push("/partner/paslaugos");
    } catch (e) {
      console.error("create service error:", e);
      setErrorMsg("Nepavyko sukurti paslaugos.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[900px] px-[16px] py-[40px]">
      <div className="mb-[24px]">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Nauja paslauga
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Sukurkite naują paslaugą
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Užpildykite pagrindinę informaciją apie paslaugą. Vėliau galėsite
          pridėti nuotraukas ir papildyti aprašymą.
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

        <form onSubmit={handleSubmit} className="space-y-[16px]">
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
                Trukmė minutėmis
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
            <label className="flex items-start gap-[10px]">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="mt-[2px] h-[16px] w-[16px]"
              />
              <span className="ui-font text-[14px] leading-[22px] text-slate-700">
                Rodyti bendrame kataloge kaip globalią paslaugą
              </span>
            </label>
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
              Kas įskaičiuota
            </label>
            <textarea
              value={includesText}
              onChange={(e) => setIncludesText(e.target.value)}
              rows={3}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Pvz. atvykimas, rekvizitai, vedimas, dekoravimo detalės..."
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
                placeholder="Pvz. sudėtis, alergenai, skoniai..."
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
              placeholder="Papildoma svarbi informacija apie paslaugą."
            />
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
