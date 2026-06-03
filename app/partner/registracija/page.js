"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const initialForm = {
  contactName: "",
  email: "",
  phone: "",
  businessName: "",
  city: "",
  description: "",
  website: "",
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function PartnerRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMsg("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");

    const payload = {
      contact_name: form.contactName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      business_name: form.businessName.trim(),
      city: form.city.trim(),
      description: form.description.trim(),
      website: form.website.trim() || null,
      status: "pending",
    };

    if (!payload.contact_name) {
      setErrorMsg("Įrašykite kontaktinį asmenį.");
      return;
    }

    if (!isValidEmail(payload.email)) {
      setErrorMsg("Įrašykite taisyklingą el. pašto adresą.");
      return;
    }

    if (!payload.business_name) {
      setErrorMsg("Įrašykite veiklos arba įmonės pavadinimą.");
      return;
    }

    if (!payload.city) {
      setErrorMsg("Įrašykite miestą.");
      return;
    }

    if (payload.description.length < 20) {
      setErrorMsg("Trumpai aprašykite savo veiklą bent keliais sakiniais.");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("partner_requests").insert(payload);

      if (error) throw error;

      setSubmitted(true);
      setForm(initialForm);
    } catch (error) {
      console.error("partner request submit error:", error);
      setErrorMsg("Nepavyko pateikti užklausos. Bandykite dar kartą.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[760px] items-center px-4 py-12">
        <section className="w-full rounded-[28px] bg-white p-8 text-center shadow-sm">
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Užklausa pateikta
          </p>
          <h1 className="mt-3 heading text-3xl font-bold text-slate-900">
            Ačiū, susisieksime el. paštu
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-slate-600">
            Administratorius peržiūrės jūsų informaciją. Jei viskas tiks,
            gausite atskirą privačią nuorodą partnerio paskyrai susikurti.
          </p>
          <Link
            href="/"
            className="ui-font mt-6 inline-flex h-11 items-center justify-center rounded-[16px] bg-primary px-5 text-sm font-semibold text-white hover:bg-dark"
          >
            Grįžti į pradžią
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[920px] px-4 py-12">
      <div className="mb-6">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Partneriams
        </p>
        <h1 className="mt-2 heading text-3xl font-bold text-slate-900 md:text-4xl">
          Pateikite partnerio užklausą
        </h1>
        <p className="mt-3 max-w-[680px] text-sm leading-6 text-slate-600">
          Partnerio paskyros nėra kuriamos viešai. Pateikite kontaktus ir
          trumpą veiklos aprašymą, o administratorius atsiųs privačią nuorodą
          paskyrai susikurti.
        </p>
      </div>

      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        {errorMsg && (
          <div className="mb-4 rounded-[16px] bg-red-50 px-4 py-3">
            <p className="ui-font text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                Kontaktinis asmuo
              </span>
              <input
                type="text"
                value={form.contactName}
                onChange={(event) => updateForm("contactName", event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                El. paštas
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                Telefonas
              </span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                Veiklos pavadinimas
              </span>
              <input
                type="text"
                value={form.businessName}
                onChange={(event) => updateForm("businessName", event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                Miestas
              </span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => updateForm("city", event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="ui-font text-sm font-semibold text-slate-600">
                Svetainė arba socialinis profilis
              </span>
              <input
                type="text"
                value={form.website}
                onChange={(event) => updateForm("website", event.target.value)}
                placeholder="Nebūtina"
                className="mt-2 h-12 w-full rounded-[16px] border border-slate-200 px-4 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="ui-font text-sm font-semibold text-slate-600">
              Veiklos aprašymas
            </span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={5}
              className="mt-2 w-full resize-none rounded-[16px] border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-primary"
              placeholder="Aprašykite, kokias paslaugas ar erdvę siūlote gimtadieniams."
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="ui-font inline-flex h-12 w-full items-center justify-center rounded-[18px] bg-primary px-5 text-sm font-semibold text-white shadow-md hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Siunčiama..." : "Pateikti užklausą"}
          </button>
        </form>
      </section>
    </main>
  );
}
