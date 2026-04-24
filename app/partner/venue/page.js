"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
}

export default function PartnerVenuePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [venue, setVenue] = useState(null);
  const [rooms, setRooms] = useState([]);

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
            "id, name, description, address, city, email, phone, website, facebook_url, google_maps_url, is_published",
          )
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (venueError) {
          throw venueError;
        }

        if (!venueRow) {
          router.replace("/partner/onboarding/venue");
          return;
        }

        setVenue(venueRow);

        const { data: roomRows, error: roomsError } = await supabase
          .from("rooms")
          .select(
            "id, name, description, price, capacity, city, duration_minutes, buffer_minutes, min_age, max_age, is_listed",
          )
          .eq("venue_id", venueRow.id)
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (roomsError) {
          throw roomsError;
        }

        setRooms(roomRows || []);
      } catch (e) {
        console.error("partner venue load error:", e);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti venue informacijos.");
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
            Venue valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Mano venue
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Čia valdysite pagrindinę venue informaciją ir kambarius.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            venue && router.push(`/partner/venue/${venue.id}/kambariai/naujas`)
          }
          className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
        >
          Pridėti naują kambarį
        </button>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {venue && (
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="flex flex-col gap-[16px] md:flex-row md:items-start md:justify-between">
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
            </div>

            <span
              className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${
                venue.is_published
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {venue.is_published ? "Paskelbta" : "Juodraštis"}
            </span>
          </div>

          <div className="mt-[20px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">El. paštas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {venue.email || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Telefonas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {venue.phone || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Svetainė</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800 break-all">
                {venue.website || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Facebook</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800 break-all">
                {venue.facebook_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px] md:col-span-2 xl:col-span-1">
              <p className="ui-font text-[12px] text-slate-500">Google Maps</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800 break-all">
                {venue.google_maps_url || "-"}
              </p>
            </div>
          </div>

          <div className="mt-[20px]">
            <button
              type="button"
              onClick={() => router.push("/partner/rezervacijos")}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Peržiūrėti rezervacijų užklausas
            </button>
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
              Sukurkite pirmą arba papildomą kambarį savo venue.
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
                className="rounded-[24px] bg-white p-[20px] shadow-sm"
              >
                <div className="flex items-start justify-between gap-[12px]">
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

                  <span
                    className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${
                      room.is_listed
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {room.is_listed ? "Paskelbtas" : "Juodraštis"}
                  </span>
                </div>

                <div className="mt-[18px] grid gap-[10px] sm:grid-cols-2">
                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Kaina</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {formatPrice(room.price)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Talpa</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {room.capacity || "-"} vaikų
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Trukmė</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {room.duration_minutes || "-"} min.
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Buffer</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {room.buffer_minutes || 0} min.
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Amžius nuo
                    </p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {room.min_age ?? "-"}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Amžius iki
                    </p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {room.max_age ?? "-"}
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
                    Valdyti kambarį
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
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
