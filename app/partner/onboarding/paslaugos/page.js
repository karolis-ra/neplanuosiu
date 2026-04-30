"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Loader from "../../../components/Loader";
import { extractCoordinatesFromGoogleMapsUrl } from "../../../lib/googleMaps";

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
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
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

  async function ensurePublicUserRow(user) {
    const payload = {
      id: user.id,
      email: user.email || null,
      full_name: user.user_metadata?.full_name || null,
    };

    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    if (existingUser?.id) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          email: payload.email,
          full_name: payload.full_name,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase.from("users").insert({
      ...payload,
      role: "service_provider",
    });

    if (insertError) {
      throw insertError;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Iveskite paslaugu profilio pavadinima.");
      return;
    }

    if (!city.trim()) {
      setErrorMsg("Iveskite miesta.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      await ensurePublicUserRow(user);

      const providerId = crypto.randomUUID();
      const locationCoordinates =
        extractCoordinatesFromGoogleMapsUrl(googleMapsUrl);

      const payload = {
        id: providerId,
        owner_id: userId || user.id,
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        city: city.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        tiktok_url: tiktokUrl.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        latitude: locationCoordinates?.latitude ?? null,
        longitude: locationCoordinates?.longitude ?? null,
        is_published: true,
      };

      const { error } = await supabase
        .from("service_providers")
        .insert(payload);

      if (error) {
        throw error;
      }

      router.push(`/partner/onboarding/paslaugos/${providerId}/pirma-paslauga`);
    } catch (e) {
      console.error("create service provider error:", {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        raw: e,
      });

      setErrorMsg(
        e?.message ||
          "Nepavyko sukurti paslaugu profilio. Bandykite dar karta.",
      );
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
          Paslaugu teikejo onboarding
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Sukurkite paslaugu profili
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Uzpildykite pagrindine informacija apie save arba savo veikla. Kitame
          zingsnyje pridesime pirma paslauga.
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
              Aprasymas
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              placeholder="Trumpai aprasykite savo veikla."
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
                placeholder="Gatve, numeris"
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
                El. pastas
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
                Svetaine
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

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Instagram nuoroda
              </label>
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="https://instagram.com/..."
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                TikTok nuoroda
              </label>
              <input
                type="text"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="https://tiktok.com/@..."
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
            {submitting ? "Saugoma..." : "Tęsti ir pridėti paslauga"}
          </button>
        </form>
      </section>
    </main>
  );
}
