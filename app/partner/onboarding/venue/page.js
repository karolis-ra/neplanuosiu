"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Loader from "../../../components/Loader";
import {
  extractCoordinatesFromGoogleMapsUrl,
  parseCoordinateInput,
} from "../../../lib/googleMaps";

const BUCKET = "public-images";

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

export default function VenueOnboardingPage() {
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
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [coverFile]);

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

      const { data: existingVenue, error: venueError } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();

      if (venueError) {
        console.error("venue check error:", venueError.message);
      }

      if (existingVenue) {
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
      setErrorMsg("Iveskite venue pavadinima.");
      return;
    }

    if (!city.trim()) {
      setErrorMsg("Iveskite miesta.");
      return;
    }

    if (!coverFile) {
      setErrorMsg("Pridekite venue viršelio nuotrauka.");
      return;
    }

    setSubmitting(true);

    let createdVenueId = null;
    let uploadedCoverPath = "";

    try {
      const urlCoordinates = extractCoordinatesFromGoogleMapsUrl(googleMapsUrl);
      const parsedLatitude = parseCoordinateInput(latitude, {
        min: -90,
        max: 90,
      });
      const parsedLongitude = parseCoordinateInput(longitude, {
        min: -180,
        max: 180,
      });

      const resolvedLatitude =
        parsedLatitude ?? urlCoordinates?.latitude ?? null;
      const resolvedLongitude =
        parsedLongitude ?? urlCoordinates?.longitude ?? null;

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
        instagram_url: instagramUrl.trim() || null,
        tiktok_url: tiktokUrl.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        is_published: true,
      };

      const { data, error } = await supabase
        .from("venues")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      createdVenueId = data.id;
      uploadedCoverPath = `venues/${data.id}/cover/${Date.now()}-${sanitizeFileName(coverFile.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedCoverPath, coverFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: imageInsertError } = await supabase.from("images").insert({
        venue_id: data.id,
        room_id: null,
        path: uploadedCoverPath,
        alt_text: name.trim(),
        alt: name.trim(),
        is_primary: true,
        is_cover: true,
        position: 0,
      });

      if (imageInsertError) {
        throw imageInsertError;
      }

      router.push(`/partner/onboarding/venue/${data.id}/kambarys`);
    } catch (e) {
      console.error("create venue error:", e);

      if (uploadedCoverPath) {
        await supabase.storage.from(BUCKET).remove([uploadedCoverPath]);
      }

      if (createdVenueId) {
        await supabase.from("images").delete().eq("venue_id", createdVenueId);
        await supabase.from("venues").delete().eq("id", createdVenueId);
      }

      setErrorMsg("Nepavyko sukurti venue. Bandykite dar karta.");
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
          Venue owner onboarding
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Sukurkite savo venue profili
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Pirmiausia uzpildykite pagrindine informacija apie savo vieta ir
          pridekite viršelio nuotrauką. Kitame zingsnyje pridesime pirma
          kambari.
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
              Venue pavadinimas
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              placeholder="Pvz. Smalsuciu sventes"
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
              placeholder="Trumpai aprasykite savo venue."
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

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Platuma
              </label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="54.6872"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Ilguma
              </label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="25.2797"
              />
            </div>
          </div>

          <p className="ui-font text-[13px] leading-[21px] text-slate-500">
            Jei norite tikslaus žemėlapio, įveskite platumą ir ilgumą ranka. Jei
            šiuos laukus paliksite tuščius, bandysime koordinates ištraukti iš
            „Google Maps“ nuorodos.
          </p>

          <div className="space-y-[10px]">
            <label className="ui-font text-[13px] text-slate-600">
              Viršelio nuotrauka
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
            />

            {coverPreviewUrl && (
              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                <Image
                  src={coverPreviewUrl}
                  alt="Venue cover"
                  width={960}
                  height={540}
                  unoptimized
                  className="h-[220px] w-full object-cover"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Saugoma..." : "Tęsti ir pridėti kambari"}
          </button>
        </form>
      </section>
    </main>
  );
}
