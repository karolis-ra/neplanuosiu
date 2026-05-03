"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";
import DatePickerControl from "../../components/DatePickerControl";
import TimeSelectControl from "../../components/TimeSelectControl";

const BUCKET = "public-images";

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function RoomBlockModal({
  room,
  form,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  if (!room) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 px-[16px] py-[24px]">
      <section className="w-full max-w-[520px] rounded-[28px] bg-white p-[22px] shadow-xl">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Užimtas laikas
            </p>
            <h2 className="mt-[6px] ui-font text-[24px] font-semibold text-slate-900">
              {room.name}
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              Pažymėkite laiką, kai kambarys užimtas už platformos ribų.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-font flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] text-slate-600 transition hover:bg-slate-50"
            aria-label="Uždaryti"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mt-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px] ui-font text-[14px] text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-[18px] space-y-[14px]">
          <label className="block">
            <span className="ui-font text-[13px] font-semibold text-slate-600">
              Data
            </span>
            <DatePickerControl
              value={form.date}
              onChange={(nextValue) => onChange("date", nextValue)}
              placeholder="Pasirinkite datą"
              className="mt-[6px]"
            />
          </label>

          <div className="grid gap-[12px] sm:grid-cols-2">
            <label className="block">
              <span className="ui-font text-[13px] font-semibold text-slate-600">
                Nuo
              </span>
              <TimeSelectControl
                value={form.startTime}
                onChange={(nextValue) => onChange("startTime", nextValue)}
                placeholder="Pradžios laikas"
                className="mt-[6px]"
              />
            </label>

            <label className="block">
              <span className="ui-font text-[13px] font-semibold text-slate-600">
                Iki
              </span>
              <TimeSelectControl
                value={form.endTime}
                onChange={(nextValue) => onChange("endTime", nextValue)}
                placeholder="Pabaigos laikas"
                className="mt-[6px]"
              />
            </label>
          </div>

          <div className="rounded-[18px] bg-slate-50 px-[14px] py-[12px]">
            <p className="ui-font text-[13px] leading-[20px] text-slate-500">
              Šiuo laiku klientai nebegalės pasirinkti persidengiančio
              rezervacijos laiko.
            </p>
          </div>

          <div className="flex flex-col gap-[10px] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Atšaukti
            </button>
            <button
              type="submit"
              disabled={saving}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saugoma..." : "Pažymėti kaip užimtą"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function PartnerVenuePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [venue, setVenue] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [provider, setProvider] = useState(null);
  const [blockingRoom, setBlockingRoom] = useState(null);
  const [blockForm, setBlockForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });
  const [blockError, setBlockError] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  function openBlockModal(room) {
    setBlockingRoom(room);
    setBlockForm({
      date: "",
      startTime: "",
      endTime: "",
    });
    setBlockError("");
  }

  function closeBlockModal() {
    if (savingBlock) return;
    setBlockingRoom(null);
    setBlockError("");
  }

  function updateBlockForm(field, value) {
    setBlockForm((current) => ({
      ...current,
      [field]: value,
    }));
    setBlockError("");
  }

  async function handleCreateRoomBlock(event) {
    event.preventDefault();

    if (!blockingRoom) return;

    const start = timeToMinutes(blockForm.startTime);
    const end = timeToMinutes(blockForm.endTime);

    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) {
      setBlockError("Užpildykite datą, pradžios ir pabaigos laiką.");
      return;
    }

    if (end <= start) {
      setBlockError("Pabaigos laikas turi būti vėlesnis už pradžios laiką.");
      return;
    }

    try {
      setSavingBlock(true);
      setBlockError("");

      const [blocksRes, bookingsRes] = await Promise.all([
        supabase
          .from("room_unavailability")
          .select("id, start_time, end_time")
          .eq("room_id", blockingRoom.id)
          .eq("date", blockForm.date),
        supabase
          .from("bookings")
          .select("id, start_time, end_time, status")
          .eq("room_id", blockingRoom.id)
          .eq("event_date", blockForm.date),
      ]);

      if (blocksRes.error) throw blocksRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      const existingBusyIntervals = [
        ...(blocksRes.data || []),
        ...(bookingsRes.data || []).filter(
          (booking) =>
            booking.status !== "cancelled" && booking.status !== "rejected",
        ),
      ];

      const hasConflict = existingBusyIntervals.some((item) =>
        rangesOverlap(
          start,
          end,
          timeToMinutes(item.start_time),
          timeToMinutes(item.end_time),
        ),
      );

      if (hasConflict) {
        setBlockError("Pasirinktas laikas jau persidengia su kitu užimtumu.");
        return;
      }

      const { error: insertError } = await supabase
        .from("room_unavailability")
        .insert({
          room_id: blockingRoom.id,
          date: blockForm.date,
          start_time: blockForm.startTime,
          end_time: blockForm.endTime,
        });

      if (insertError) throw insertError;

      setBlockingRoom(null);
      setBlockError("");
    } catch (error) {
      console.error("room block insert error:", error);
      setBlockError("Nepavyko pažymėti užimto laiko. Bandykite dar kartą.");
    } finally {
      setSavingBlock(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadVenueData() {
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

        const { data: venueRow, error: venueError } = await supabase
          .from("venues")
          .select(
            "id, name, description, address, city, email, phone, website, facebook_url, instagram_url, tiktok_url, google_maps_url",
          )
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (venueError) {
          throw venueError;
        }

        if (!venueRow) {
          router.replace("/partner/onboarding/venue");
          return;
        }

        const [{ data: coverImage }, { data: providerRow }] = await Promise.all(
          [
            supabase
              .from("images")
              .select("path")
              .eq("venue_id", venueRow.id)
              .is("room_id", null)
              .eq("is_cover", true)
              .order("position", { ascending: true })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("service_providers")
              .select("id, name")
              .eq("owner_id", user.id)
              .limit(1)
              .maybeSingle(),
          ],
        );

        setProvider(providerRow || null);

        setVenue({
          ...venueRow,
          coverUrl: getPublicUrl(coverImage?.path),
        });

        const { data: roomRows, error: roomsError } = await supabase
          .from("rooms")
          .select(
            "id, name, description, price, capacity, city, duration_minutes, buffer_minutes, min_age, max_age",
          )
          .eq("venue_id", venueRow.id)
          .order("created_at", { ascending: true });

        if (roomsError) {
          throw roomsError;
        }

        const roomIds = (roomRows || []).map((room) => room.id);

        const [{ data: roomImages }, { data: roomServices }] =
          await Promise.all([
            roomIds.length
              ? supabase
                  .from("images")
                  .select("room_id, path, is_primary, is_cover, position")
                  .in("room_id", roomIds)
              : Promise.resolve({ data: [] }),
            roomIds.length
              ? supabase
                  .from("services")
                  .select("id, room_id")
                  .in("room_id", roomIds)
              : Promise.resolve({ data: [] }),
          ]);

        const imagesByRoomId = new Map();
        (roomImages || []).forEach((item) => {
          if (!imagesByRoomId.has(item.room_id)) {
            imagesByRoomId.set(item.room_id, []);
          }
          imagesByRoomId.get(item.room_id).push(item);
        });

        const serviceCounts = new Map();
        (roomServices || []).forEach((item) => {
          serviceCounts.set(
            item.room_id,
            (serviceCounts.get(item.room_id) || 0) + 1,
          );
        });

        const enrichedRooms = (roomRows || []).map((room) => {
          const roomGallery = (imagesByRoomId.get(room.id) || []).sort(
            (a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              if (a.is_cover && !b.is_cover) return -1;
              if (!a.is_cover && b.is_cover) return 1;
              return (a.position ?? 9999) - (b.position ?? 9999);
            },
          );

          return {
            ...room,
            coverUrl: getPublicUrl(roomGallery[0]?.path),
            imagesCount: roomGallery.length,
            servicesCount: serviceCounts.get(room.id) || 0,
          };
        });

        if (!isMounted) return;
        setRooms(enrichedRooms);
      } catch (e) {
        console.error("partner venue load error:", e);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti žaidimų erdvės informacijos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadVenueData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px] flex flex-col gap-[16px] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Žaidimų erdvės valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Mano žaidimų erdvė
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Čia valdysite pagrindinę informaciją, kambarius ir su kambariais
            susijusias paslaugas.
          </p>
        </div>

        <div className="flex flex-col gap-[10px] sm:flex-row">
          <button
            type="button"
            onClick={() =>
              venue && router.push(`/partner/venue/${venue.id}/redaguoti`)
            }
            className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Redaguoti erdvę
          </button>

          <button
            type="button"
            onClick={() =>
              venue &&
              router.push(`/partner/venue/${venue.id}/kambariai/naujas`)
            }
            className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
          >
            Pridėti naują kambarį
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {venue && (
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="grid gap-[20px] lg:grid-cols-[1.3fr,0.9fr]">
            <div>
              <h2 className="ui-font text-[24px] font-semibold text-slate-900">
                {venue.name}
              </h2>

              {(venue.address || venue.city) && (
                <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                  {venue.address || ""}
                  {venue.address && venue.city ? ", " : ""}
                  {venue.city || ""}
                </p>
              )}

              {venue.description && (
                <p className="mt-[12px] ui-font max-w-[760px] text-[14px] leading-[22px] text-slate-600">
                  {venue.description}
                </p>
              )}

              <div className="mt-[20px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">
                    El. paštas
                  </p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.email || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">
                    Telefonas
                  </p>
                  <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                    {venue.phone || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">
                    Svetainė
                  </p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.website || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">Facebook</p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.facebook_url || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">
                    Instagram
                  </p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.instagram_url || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px]">
                  <p className="ui-font text-[12px] text-slate-500">TikTok</p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.tiktok_url || "-"}
                  </p>
                </div>

                <div className="rounded-[20px] bg-slate-50 p-[14px] md:col-span-2 xl:col-span-3">
                  <p className="ui-font text-[12px] text-slate-500">
                    Google Maps
                  </p>
                  <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                    {venue.google_maps_url || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-[20px] flex flex-col gap-[10px] sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/partner/rezervacijos")}
                  className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Peržiūrėti rezervacijų užklausas
                </button>

                {!provider && (
                  <button
                    type="button"
                    onClick={() => router.push("/partner/onboarding/paslaugos")}
                    className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                  >
                    Sukurti paslaugų profilį
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] bg-slate-100">
              {venue.coverUrl ? (
                <Image
                  src={venue.coverUrl}
                  alt={venue.name}
                  width={900}
                  height={720}
                  unoptimized
                  className="h-full min-h-[280px] w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center bg-gradient-to-br from-primary to-dark px-[24px] text-center">
                  <p className="ui-font text-[16px] font-semibold text-white">
                    Viršelio nuotrauka dar nepridėta
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-[24px]">
        <div className="mb-[16px] flex items-center justify-between">
          <h2 className="ui-font text-[24px] font-semibold text-slate-900">
            Kambariai
          </h2>
          <span className="ui-font text-[14px] text-slate-500">
            Iš viso: {rooms.length}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[32px] text-center">
            <p className="ui-font text-[16px] font-semibold text-slate-800">
              Kambarių dar nėra
            </p>
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Sukurkite pirmą arba papildomą kambarį savo žaidimų erdvei.
            </p>

            <button
              type="button"
              onClick={() =>
                venue &&
                router.push(`/partner/venue/${venue.id}/kambariai/naujas`)
              }
              className="ui-font mt-[16px] inline-flex h-[48px] items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark"
            >
              Pridėti kambarį
            </button>
          </div>
        ) : (
          <div className="grid gap-[16px] lg:grid-cols-2">
            {rooms.map((room) => (
              <article
                key={room.id}
                className="overflow-hidden rounded-[24px] bg-white shadow-sm"
              >
                <div className="grid gap-[0px] sm:grid-cols-[220px,1fr]">
                  <div className="bg-slate-100">
                    {room.coverUrl ? (
                      <Image
                        src={room.coverUrl}
                        alt={room.name}
                        width={800}
                        height={600}
                        unoptimized
                        className="h-full min-h-[220px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center bg-slate-100 px-[16px] text-center">
                        <p className="ui-font text-[13px] font-semibold text-slate-400">
                          Nuotraukos dar neįkeltos
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-[20px]">
                    <div>
                      <h3 className="ui-font text-[20px] font-semibold text-slate-900">
                        {room.name}
                      </h3>
                      {room.description && (
                        <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
                          {room.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-[18px] grid gap-[10px] sm:grid-cols-2">
                      <div className="rounded-[18px] bg-slate-50 p-[12px]">
                        <p className="ui-font text-[12px] text-slate-500">
                          Kaina
                        </p>
                        <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                          {formatPrice(room.price)}
                        </p>
                      </div>

                      <div className="rounded-[18px] bg-slate-50 p-[12px]">
                        <p className="ui-font text-[12px] text-slate-500">
                          Talpa
                        </p>
                        <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                          {room.capacity || "-"} vaikų
                        </p>
                      </div>

                      <div className="rounded-[18px] bg-slate-50 p-[12px]">
                        <p className="ui-font text-[12px] text-slate-500">
                          Trukmė
                        </p>
                        <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                          {room.duration_minutes || "-"} min.
                        </p>
                      </div>

                      <div className="rounded-[18px] bg-slate-50 p-[12px]">
                        <p className="ui-font text-[12px] text-slate-500">
                          Nuotraukos / paslaugos
                        </p>
                        <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                          {room.imagesCount} / {room.servicesCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-[18px] flex flex-col gap-[10px] sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/partner/venue/kambariai/${room.id}`)
                        }
                        className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                      >
                        Redaguoti kambarį
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/partner/venue/kambariai/${room.id}/paslaugos`,
                          )
                        }
                        className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Kambario paslaugos
                      </button>

                      <button
                        type="button"
                        onClick={() => openBlockModal(room)}
                        className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-amber-200 bg-amber-50 px-[16px] text-[14px] font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        Blokuoti laiką
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <RoomBlockModal
        room={blockingRoom}
        form={blockForm}
        saving={savingBlock}
        error={blockError}
        onChange={updateBlockForm}
        onClose={closeBlockModal}
        onSubmit={handleCreateRoomBlock}
      />
    </main>
  );
}
