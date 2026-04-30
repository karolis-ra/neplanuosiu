"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";

const BUCKET = "public-images";

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
}

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

export default function PartnerVenuePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [venue, setVenue] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [provider, setProvider] = useState(null);

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
          setErrorMsg("Nepavyko uzkrauti zaidimu erdves informacijos.");
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
            Zaidimu erdves valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Mano zaidimu erdve
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Cia valdysite pagrindine informacija, kambarius ir su kambariais
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
            Redaguoti erdve
          </button>

          <button
            type="button"
            onClick={() =>
              venue &&
              router.push(`/partner/venue/${venue.id}/kambariai/naujas`)
            }
            className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
          >
            pridėti nauja kambari
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
                    El. pastas
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
                  <p className="ui-font text-[12px] text-slate-500">Svetaine</p>
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
                  Perziureti rezervaciju uzklausas
                </button>

                {!provider && (
                  <button
                    type="button"
                    onClick={() => router.push("/partner/onboarding/paslaugos")}
                    className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                  >
                    Sukurti paslaugu profili
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
                    Viršelio nuotrauka dar neprideta
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
            Is viso: {rooms.length}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[32px] text-center">
            <p className="ui-font text-[16px] font-semibold text-slate-800">
              Kambariu dar nera
            </p>
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Sukurkite pirma arba papildoma kambari savo zaidimu erdvei.
            </p>

            <button
              type="button"
              onClick={() =>
                venue &&
                router.push(`/partner/venue/${venue.id}/kambariai/naujas`)
              }
              className="ui-font mt-[16px] inline-flex h-[48px] items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark"
            >
              pridėti kambari
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
                          Nuotraukos dar neikeltos
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
                          {room.capacity || "-"} vaiku
                        </p>
                      </div>

                      <div className="rounded-[18px] bg-slate-50 p-[12px]">
                        <p className="ui-font text-[12px] text-slate-500">
                          Trukme
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

                    <div className="mt-[18px] flex flex-col gap-[10px] sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/partner/venue/kambariai/${room.id}`)
                        }
                        className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                      >
                        Redaguoti kambari
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
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
