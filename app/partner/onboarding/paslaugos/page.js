"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Loader from "../../../components/Loader";

export default function ServiceProviderOnboardingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [userId, setUserId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error) {
        console.error("auth error:", error.message);
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data: existingProvider, error: providerError } = await supabase
        .from("service_providers")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      if (providerError) {
        console.error("provider check error:", providerError.message);
      }

      if (existingProvider) {
        router.replace("/partner");
        return;
      }

      setLoading(false);
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Įveskite paslaugų profilio pavadinimą.");
      return;
    }

    if (!city.trim()) {
      setErrorMsg("Įveskite miestą.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        owner_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        city: city.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        is_published: false,
      };

      const { data, error } = await supabase
        .from("service_providers")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      router.push(`/partner/onboarding/paslaugos/${data.id}/pirma-paslauga`);
    } catch (e) {
      console.error("create service provider error:", e);
      setErrorMsg("Nepavyko sukurti paslaugų profilio. Bandykite dar kartą.");
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
          Paslaugų teikėjo onboarding
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Sukurkite paslaugų profilį
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Užpildykite pagrindinę informaciją apie save arba savo veiklą. Kitame
          žingsnyje pridėsime pirmą paslaugą.
        </p>
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
              Profilio pavadinimas
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              placeholder="Pvz. Linksmi animatoriai"
            />
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Aprašymas
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Trumpai aprašykite savo veiklą."
            />
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Adresas
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="Gatvė, numeris"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Miestas
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="Vilnius"
              />
            </div>
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                El. paštas
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="info@pavyzdys.lt"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Telefonas
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="+370..."
              />
            </div>
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Svetainė
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Facebook nuoroda
              </label>
              <input
                type="text"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Google Maps nuoroda
            </label>
            <input
              type="text"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              placeholder="https://maps.google.com/..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Saugoma..." : "Tęsti ir pridėti paslaugą"}
          </button>
        </form>
      </section>
    </main>
  );
}
