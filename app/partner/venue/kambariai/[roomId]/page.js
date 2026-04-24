"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import Loader from "../../../../components/Loader";

const BUCKET = "public-images";
const WEEKDAYS = [
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

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

export default function EditRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [room, setRoom] = useState(null);
  const [venueId, setVenueId] = useState("");

  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [city, setCity] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [bufferMinutes, setBufferMinutes] = useState("0");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("21:00");
  const [selectedDays, setSelectedDays] = useState([]);
  const [images, setImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  const newFilePreviews = useMemo(
    () =>
      newFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [newFiles],
  );

  useEffect(() => {
    return () => {
      newFilePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [newFilePreviews]);

  const loadRoomData = useCallback(async (ownerId) => {
    const { data: roomRow, error: roomError } = await supabase
      .from("rooms")
      .select(
        "id, venue_id, name, description, price, capacity, city, duration_minutes, buffer_minutes, min_age, max_age",
      )
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!roomRow) {
      router.replace("/partner/venue");
      return;
    }

    const { data: venueRow, error: venueError } = await supabase
      .from("venues")
      .select("id, owner_id")
      .eq("id", roomRow.venue_id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (venueError) throw venueError;
    if (!venueRow) {
      router.replace("/partner/venue");
      return;
    }

    const [{ data: availabilityRows }, { data: imageRows }] = await Promise.all([
      supabase
        .from("availability")
        .select("id, weekday, start_time, end_time")
        .eq("room_id", roomId)
        .order("weekday", { ascending: true }),
      supabase
        .from("images")
        .select("id, path, position, is_primary, is_cover")
        .eq("room_id", roomId)
        .order("position", { ascending: true }),
    ]);

    setRoom(roomRow);
    setVenueId(roomRow.venue_id);
    setRoomName(roomRow.name || "");
    setDescription(roomRow.description || "");
    setPrice(String(roomRow.price ?? ""));
    setCapacity(String(roomRow.capacity ?? ""));
    setCity(roomRow.city || "");
    setDurationMinutes(String(roomRow.duration_minutes ?? "120"));
    setBufferMinutes(String(roomRow.buffer_minutes ?? "0"));
    setMinAge(roomRow.min_age == null ? "" : String(roomRow.min_age));
    setMaxAge(roomRow.max_age == null ? "" : String(roomRow.max_age));

    if (availabilityRows?.length) {
      setSelectedDays(availabilityRows.map((item) => item.weekday));
      setOpenTime(String(availabilityRows[0].start_time || "").slice(0, 5));
      setCloseTime(String(availabilityRows[0].end_time || "").slice(0, 5));
    }

    setImages(
      (imageRows || []).map((item) => ({
        ...item,
        publicUrl: getPublicUrl(item.path),
      })),
    );
  }, [roomId, router]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/prisijungti");
          return;
        }

        await loadRoomData(user.id);
      } catch (error) {
        console.error("load room manage error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko uzkrauti kambario informacijos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (roomId) {
      loadPage();
    }

    return () => {
      isMounted = false;
    };
  }, [loadRoomData, roomId, router]);

  function toggleDay(dayValue) {
    setSelectedDays((current) =>
      current.includes(dayValue)
        ? current.filter((value) => value !== dayValue)
        : [...current, dayValue].sort((a, b) => a - b),
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      const { error: roomUpdateError } = await supabase
        .from("rooms")
        .update({
          name: roomName.trim() || null,
          description: description.trim() || null,
          price: price === "" ? null : Number(price),
          capacity: capacity === "" ? null : Number(capacity),
          city: city.trim() || null,
          duration_minutes: durationMinutes === "" ? null : Number(durationMinutes),
          buffer_minutes: bufferMinutes === "" ? 0 : Number(bufferMinutes),
          min_age: minAge === "" ? null : Number(minAge),
          max_age: maxAge === "" ? null : Number(maxAge),
        })
        .eq("id", roomId);

      if (roomUpdateError) throw roomUpdateError;

      await supabase.from("availability").delete().eq("room_id", roomId);

      if (selectedDays.length > 0 && openTime && closeTime) {
        const availabilityRows = selectedDays.map((weekday) => ({
          room_id: roomId,
          weekday,
          start_time: openTime,
          end_time: closeTime,
        }));

        const { error: availabilityError } = await supabase
          .from("availability")
          .insert(availabilityRows);

        if (availabilityError) throw availabilityError;
      }

      await loadRoomData(user.id);
      setSuccessMsg("Kambario informacija issaugota.");
    } catch (error) {
      console.error("save room error:", error);
      setErrorMsg("Nepavyko issaugoti kambario informacijos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadImages() {
    if (!newFiles.length || !venueId) return;

    setUploadingImages(true);
    setErrorMsg("");
    setSuccessMsg("");

    const uploadedPaths = [];

    try {
      for (let index = 0; index < newFiles.length; index += 1) {
        const file = newFiles[index];
        const path = `venues/${venueId}/rooms/${roomId}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
      }

      const imageRows = uploadedPaths.map((path, index) => ({
        venue_id: venueId,
        room_id: roomId,
        path,
        position: images.length + index,
        is_primary: images.length === 0 && index === 0,
        is_cover: images.length === 0 && index === 0,
      }));

      const { error: imageInsertError } = await supabase
        .from("images")
        .insert(imageRows);

      if (imageInsertError) throw imageInsertError;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await loadRoomData(user.id);
      setNewFiles([]);
      setSuccessMsg("Kambario nuotraukos pridetos.");
    } catch (error) {
      console.error("upload room images error:", error);
      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
      }
      setErrorMsg("Nepavyko ikelti kambario nuotrauku.");
    } finally {
      setUploadingImages(false);
    }
  }

  async function handleDeleteImage(imageId, pathToDelete) {
    try {
      await supabase.from("images").delete().eq("id", imageId);
      if (pathToDelete) {
        await supabase.storage.from(BUCKET).remove([pathToDelete]);
      }

      const { data: remainingImages } = await supabase
        .from("images")
        .select("id")
        .eq("room_id", roomId)
        .order("position", { ascending: true });

      if (remainingImages?.length) {
        await supabase
          .from("images")
          .update({ is_primary: false, is_cover: false })
          .eq("room_id", roomId);

        await supabase
          .from("images")
          .update({ is_primary: true, is_cover: true, position: 0 })
          .eq("id", remainingImages[0].id);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await loadRoomData(user.id);
    } catch (error) {
      console.error("delete room image error:", error);
      setErrorMsg("Nepavyko istrinti nuotraukos.");
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[980px] px-[16px] py-[40px]">
      <div className="mb-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Kambario valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Redaguoti kambari
          </h1>
        </div>

        <div className="flex flex-col gap-[10px] sm:flex-row">
          <button
            type="button"
            onClick={() => router.push(`/partner/venue/kambariai/${roomId}/paslaugos`)}
            className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
          >
            Valdyti kambario paslaugas
          </button>

          <button
            type="button"
            onClick={() => router.push("/partner/venue")}
            className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Grizti i valdyma
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-[16px] rounded-[16px] bg-emerald-50 px-[14px] py-[10px]">
          <p className="ui-font text-[14px] text-emerald-700">{successMsg}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-[20px]">
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="space-y-[16px]">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Kambario pavadinimas
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
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
              />
            </div>

            <div className="grid gap-[12px] md:grid-cols-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Kaina"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Talpa"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Miestas"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <div className="grid gap-[12px] md:grid-cols-4">
              <input
                type="number"
                min="30"
                step="30"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="Trukme"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                step="15"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                placeholder="Bufferis"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                placeholder="Min amzius"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
              <input
                type="number"
                min="0"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                placeholder="Max amzius"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-[12px]">
              <p className="ui-font text-[13px] text-slate-600">
                Darbo dienos
              </p>
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

              <div className="grid gap-[12px] md:grid-cols-2">
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
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
          <div className="flex items-center justify-between gap-[12px]">
            <div>
              <h2 className="ui-font text-[20px] font-semibold text-slate-900">
                Kambario nuotraukos
              </h2>
              <p className="ui-font mt-[4px] text-[14px] text-slate-500">
                Galite prideti ir istrinti esamas kambario galerijos nuotraukas.
              </p>
            </div>
          </div>

          <div className="mt-[16px] space-y-[14px]">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
              className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
            />

            {newFilePreviews.length > 0 && (
              <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
                {newFilePreviews.map((item) => (
                  <div
                    key={item.url}
                    className="overflow-hidden rounded-[20px] border border-dashed border-slate-200 bg-slate-50"
                  >
                    <Image
                      src={item.url}
                      alt={item.name}
                      width={800}
                      height={480}
                      unoptimized
                      className="h-[180px] w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={!newFiles.length || uploadingImages}
              onClick={handleUploadImages}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {uploadingImages ? "Keliama..." : "Prideti nuotraukas"}
            </button>

            <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-[20px] border border-slate-200 bg-white"
                >
                  <Image
                    src={image.publicUrl}
                    alt={roomName || "Kambario nuotrauka"}
                    width={800}
                    height={480}
                    unoptimized
                    className="h-[180px] w-full object-cover"
                  />

                  <div className="flex items-center justify-between gap-[10px] px-[12px] py-[10px]">
                    <span className="ui-font text-[12px] text-slate-500">
                      {image.is_primary ? "Pagrindine" : `Pozicija ${image.position + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id, image.path)}
                      className="ui-font text-[13px] font-semibold text-red-600"
                    >
                      Istrinti
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saugoma..." : "Issaugoti kambario pakeitimus"}
        </button>
      </form>
    </main>
  );
}
