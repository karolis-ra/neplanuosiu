"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import Loader from "../../../../../components/Loader";

const BUCKET = "public-images";
const WEEKDAYS = [
  { value: 1, label: "Pirmadienis", shortLabel: "Pr" },
  { value: 2, label: "Antradienis", shortLabel: "An" },
  { value: 3, label: "Trečiadienis", shortLabel: "Tr" },
  { value: 4, label: "Ketvirtadienis", shortLabel: "Kt" },
  { value: 5, label: "Penktadienis", shortLabel: "Pn" },
  { value: 6, label: "Šeštadienis", shortLabel: "Št" },
  { value: 0, label: "Sekmadienis", shortLabel: "Sk" },
];

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

export default function VenueRoomOnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const venueId = params?.venue_id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [extraHourPrice, setExtraHourPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [bufferMinutes, setBufferMinutes] = useState("0");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("21:00");
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
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
      if (!venueId) {
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

      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("id, address, city, phone, email, website")
        .eq("id", venueId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (venueError) {
        console.error("venue access error:", venueError.message);
      }

      if (!venue) {
        router.replace("/partner");
        return;
      }

      setAddress(venue.address || "");
      setCity(venue.city || "");
      setPhone(venue.phone || "");
      setEmail(venue.email || "");
      setWebsite(venue.website || "");
      setLoading(false);
    }

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [router, venueId]);

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

    const trimmedName = roomName.trim();
    const trimmedDescription = description.trim();
    const trimmedAddress = address.trim();
    const trimmedCity = city.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedWebsite = website.trim();

    if (!trimmedName) {
      setErrorMsg("Įveskite kambario pavadinimą.");
      return;
    }

    if (!price || Number(price) < 0) {
      setErrorMsg("Įveskite teisingą kainą.");
      return;
    }

    if (!capacity || Number(capacity) <= 0) {
      setErrorMsg("Įveskite kambario talpą.");
      return;
    }

    if (extraHourPrice === "" || Number(extraHourPrice) < 0) {
      setErrorMsg("Nurodykite teisinga papildomos valandos kaina.");
      return;
    }

    if (!durationMinutes || Number(durationMinutes) <= 0) {
      setErrorMsg("Nurodykite minimalią rezervacijos trukmę minutėmis.");
      return;
    }

    if (!trimmedAddress || !trimmedCity) {
      setErrorMsg("Nurodykite vietą: adresą ir miestą.");
      return;
    }

    if (!trimmedPhone && !trimmedEmail) {
      setErrorMsg("Nurodykite bent vieną kontaktą: telefoną arba el. paštą.");
      return;
    }

    if (selectedDays.length === 0) {
      setErrorMsg("Pasirinkite bent vieną darbo dieną.");
      return;
    }

    if (!openTime || !closeTime || openTime >= closeTime) {
      setErrorMsg("Nurodykite teisingas darbo valandas.");
      return;
    }

    if (photoFiles.length === 0) {
      setErrorMsg("Pridėkite bent vieną kambario nuotrauką.");
      return;
    }

    setSubmitting(true);

    let createdRoomId = null;
    const uploadedPaths = [];

    try {
      const roomPayload = {
        venue_id: venueId,
        name: trimmedName,
        description: trimmedDescription || null,
        price: Number(price),
        extra_hour_price: Number(extraHourPrice),
        capacity: Number(capacity),
        city: trimmedCity,
        duration_minutes: Number(durationMinutes),
        buffer_minutes: Number(bufferMinutes || 0),
        min_age: minAge ? Number(minAge) : null,
        max_age: maxAge ? Number(maxAge) : null,
        is_listed: true,
      };

      const { data: roomRow, error: roomError } = await supabase
        .from("rooms")
        .insert(roomPayload)
        .select("id")
        .single();

      if (roomError) {
        throw roomError;
      }

      createdRoomId = roomRow.id;

      const venueUpdatePayload = {
        address: trimmedAddress,
        city: trimmedCity,
        phone: trimmedPhone || null,
        email: trimmedEmail || null,
        website: trimmedWebsite || null,
        is_published: true,
      };

      const { error: venueUpdateError } = await supabase
        .from("venues")
        .update(venueUpdatePayload)
        .eq("id", venueId);

      if (venueUpdateError) {
        throw venueUpdateError;
      }

      const availabilityRows = selectedDays.map((weekday) => ({
        room_id: createdRoomId,
        weekday,
        start_time: openTime,
        end_time: closeTime,
      }));

      const { error: availabilityError } = await supabase
        .from("availability")
        .insert(availabilityRows);

      if (availabilityError) {
        throw availabilityError;
      }

      for (let index = 0; index < photoFiles.length; index += 1) {
        const file = photoFiles[index];
        const filePath = `venues/${venueId}/rooms/${createdRoomId}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(filePath);
      }

      const imageRows = uploadedPaths.map((path, index) => ({
        room_id: createdRoomId,
        venue_id: venueId,
        path,
        position: index,
        is_primary: index === 0,
        is_cover: index === 0,
      }));

      const { error: imagesError } = await supabase
        .from("images")
        .insert(imageRows);

      if (imagesError) {
        throw imagesError;
      }

      router.push("/partner");
    } catch (e) {
      console.error("create room error:", e);

      if (uploadedPaths.length > 0) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
      }

      if (createdRoomId) {
        await supabase.from("images").delete().eq("room_id", createdRoomId);
        await supabase
          .from("availability")
          .delete()
          .eq("room_id", createdRoomId);
        await supabase.from("rooms").delete().eq("id", createdRoomId);
      }

      setErrorMsg("Nepavyko sukurti kambario. Patikrinkite laukus ir bandykite dar kartą.");
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
          Venue owner onboarding
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Pridėkite pirmą kambarį
        </h1>
        <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
          Iškart nurodykite kambario trukmę, vietą, kontaktus, darbo laiką ir
          nuotraukas, kad kambarys būtų paruoštas rezervacijoms.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-[20px]">
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <h2 className="ui-font text-[20px] font-semibold text-slate-900">
            Pagrindinė informacija
          </h2>

          <div className="mt-[16px] space-y-[16px]">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Kambario pavadinimas
              </label>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="Pvz. Džiunglių kambarys"
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
                placeholder="Trumpai aprašykite kambarį."
              />
            </div>

            <div className="grid gap-[12px] md:grid-cols-4">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Minimali rezervacijos trukmė (min.)
                </label>
                <input
                  type="number"
                  min="30"
                  step="30"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="120"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Kaina
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="150"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Papildomos valandos kaina
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraHourPrice}
                  onChange={(e) => setExtraHourPrice(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="20"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Talpa
                </label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="15"
                />
              </div>
            </div>

            <div className="grid gap-[12px] md:grid-cols-3">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Bufferis tarp rezervacijų (min.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="0"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Min. amžius
                </label>
                <input
                  type="number"
                  min="0"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="3"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Max. amžius
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="10"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <h2 className="ui-font text-[20px] font-semibold text-slate-900">
            Vieta ir kontaktai
          </h2>

          <div className="mt-[16px] space-y-[16px]">
            <div className="grid gap-[12px] md:grid-cols-2">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Adresas
                </label>
                <input
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
                  Telefonas
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  placeholder="+370..."
                />
              </div>

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
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Svetainė
              </label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                placeholder="https://..."
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <h2 className="ui-font text-[20px] font-semibold text-slate-900">
            Darbo dienos ir valandos
          </h2>

          <div className="mt-[16px]">
            <div className="flex flex-wrap gap-[10px]">
              {WEEKDAYS.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`ui-font inline-flex h-[44px] items-center justify-center rounded-full border px-[16px] text-[14px] font-medium transition ${
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

            <div className="mt-[16px] grid gap-[12px] md:grid-cols-2">
              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Darbo pradžia
                </label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-[6px]">
                <label className="ui-font text-[13px] text-slate-600">
                  Darbo pabaiga
                </label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <h2 className="ui-font text-[20px] font-semibold text-slate-900">
            Nuotraukos
          </h2>

          <div className="mt-[16px] space-y-[14px]">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
            />

            {photoPreviews.length > 0 && (
              <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
                {photoPreviews.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50"
                  >
                    <Image
                      src={item.url}
                      alt={item.name}
                      width={640}
                      height={360}
                      unoptimized
                      className="h-[180px] w-full object-cover"
                    />
                    <div className="px-[12px] py-[10px]">
                      <p className="ui-font truncate text-[13px] text-slate-600">
                        {item.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="ui-font inline-flex h-[52px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saugoma..." : "Sukurti kambarį"}
        </button>
      </form>
    </main>
  );
}
