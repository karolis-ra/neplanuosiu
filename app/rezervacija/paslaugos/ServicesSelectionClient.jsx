"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  buildReservationInterval,
  groupServicesByType,
  isProviderAvailableForReservation,
} from "../../lib/serviceAvailability";

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function getWeekdayFromDateString(dateStr) {
  return new Date(dateStr).getDay();
}

function CategorySection({
  title,
  items,
  selectedId,
  selectedOrigin,
  onSelect,
  emptyText,
}) {
  if (!items.length) {
    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-[20px] shadow-sm">
        <div className="mb-[10px] flex items-center justify-between gap-[10px]">
          <h2 className="ui-font text-[20px] font-semibold text-slate-900">
            {title}
          </h2>
        </div>
        <p className="ui-font text-[14px] text-slate-500">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-[20px] shadow-sm">
      <div className="mb-[16px] flex items-center justify-between gap-[10px]">
        <h2 className="ui-font text-[20px] font-semibold text-slate-900">
          {title}
        </h2>
        <span className="ui-font rounded-full bg-slate-100 px-[10px] py-[5px] text-[12px] text-slate-600">
          {items.length} pasiūlymai
        </span>
      </div>

      <div className="grid gap-[14px] md:grid-cols-2">
        {items.map((item) => {
          const isSelected =
            selectedId === item.id && selectedOrigin === item.__origin;

          return (
            <button
              key={`${item.__origin}-${item.id}`}
              type="button"
              onClick={() => onSelect(item)}
              className={`text-left rounded-[22px] border p-[16px] transition ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              <div className="mb-[10px] flex items-start justify-between gap-[12px]">
                <div>
                  <p className="ui-font text-[16px] font-semibold text-slate-900">
                    {item.name}
                  </p>
                  <p className="ui-font mt-[4px] text-[12px] text-slate-500">
                    {item.__originLabel}
                  </p>
                </div>

                <span className="ui-font whitespace-nowrap rounded-full bg-amber-50 px-[10px] py-[5px] text-[12px] font-semibold text-amber-700">
                  {formatPrice(item.price_per_unit)}
                </span>
              </div>

              {item.description && (
                <p className="ui-font text-[13px] leading-[20px] text-slate-600">
                  {item.description}
                </p>
              )}

              <div className="mt-[14px] flex items-center justify-between gap-[10px]">
                <span className="ui-font text-[12px] text-slate-500">
                  Matavimo vienetas: {item.units_of_measure || "unit"}
                </span>

                <span
                  className={`ui-font inline-flex rounded-full px-[10px] py-[6px] text-[12px] font-medium ${
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {isSelected ? "Pasirinkta" : "Pasirinkti"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ServicesSelectionClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = searchParams.get("roomId");
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const duration = Number(searchParams.get("duration") || "0");
  const roomTotal = Number(searchParams.get("roomTotal") || "0");

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [venue, setVenue] = useState(null);
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");

  const [selectedDecorations, setSelectedDecorations] = useState(null);
  const [selectedAnimator, setSelectedAnimator] = useState(null);
  const [selectedCake, setSelectedCake] = useState(null);

  const reservation = useMemo(() => {
    return buildReservationInterval({
      startTime: time,
      durationMinutes: duration,
    });
  }, [time, duration]);

  useEffect(() => {
    if (!roomId || !date || !time || !duration) {
      router.replace("/");
    }
  }, [roomId, date, time, duration, router]);

  useEffect(() => {
    if (!roomId || !date || !time || !duration) return;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const weekday = getWeekdayFromDateString(date);

        const { data: roomData, error: roomError } = await supabase
          .from("rooms")
          .select("id, venue_id, name, price")
          .eq("id", roomId)
          .single();

        if (roomError) throw roomError;

        setRoom(roomData || null);

        if (roomData?.venue_id) {
          const { data: venueData } = await supabase
            .from("venues")
            .select("id, name, address, city")
            .eq("id", roomData.venue_id)
            .single();

          setVenue(venueData || null);
        }

        const venueId = roomData?.venue_id || null;

        const { data: serviceRows, error: serviceError } = await supabase
          .from("services")
          .select(
            "id, provider_id, room_id, venue_id, name, description, service_type, price_per_unit, units_of_measure, is_global, is_listed, sort_order",
          )
          .eq("is_listed", true)
          .or(
            venueId
              ? `room_id.eq.${roomId},venue_id.eq.${venueId},is_global.eq.true`
              : `room_id.eq.${roomId},is_global.eq.true`,
          )
          .order("sort_order", { ascending: true })
          .order("price_per_unit", { ascending: true });

        if (serviceError) throw serviceError;

        const scopedServices = (serviceRows || []).filter(
          (item) =>
            item.service_type === "decorations" ||
            item.service_type === "animator" ||
            item.service_type === "cake",
        );

        if (!scopedServices.length) {
          setServices([]);
          return;
        }

        const providerIds = Array.from(
          new Set(
            scopedServices.map((item) => item.provider_id).filter(Boolean),
          ),
        );

        const candidateServiceIds = scopedServices.map((item) => item.id);

        const [
          providersRes,
          availabilityRes,
          unavailabilityRes,
          relatedServicesRes,
          bookingServicesRes,
        ] = await Promise.all([
          supabase
            .from("service_providers")
            .select("id, name, is_published")
            .in("id", providerIds)
            .eq("is_published", true),

          supabase
            .from("service_provider_availability")
            .select("id, provider_id, weekday, start_time, end_time")
            .in("provider_id", providerIds)
            .eq("weekday", weekday),

          supabase
            .from("service_provider_unavailability")
            .select("id, provider_id, date, start_time, end_time")
            .in("provider_id", providerIds)
            .eq("date", date),

          supabase
            .from("services")
            .select("id, provider_id")
            .in("provider_id", providerIds),

          supabase
            .from("booking_services")
            .select(
              `
                booking_id,
                service_id,
                start_time,
                end_time,
                booking:bookings!booking_services_booking_id_fkey (
                  event_date,
                  status
                )
              `,
            )
            .in("service_id", candidateServiceIds),
        ]);

        if (providersRes.error) throw providersRes.error;
        if (availabilityRes.error) throw availabilityRes.error;
        if (unavailabilityRes.error) throw unavailabilityRes.error;
        if (relatedServicesRes.error) throw relatedServicesRes.error;
        if (bookingServicesRes.error) throw bookingServicesRes.error;

        const publishedProviderIds = new Set(
          (providersRes.data || []).map((item) => item.id),
        );

        const providerServiceIdsMap = new Map();

        (relatedServicesRes.data || []).forEach((item) => {
          if (!providerServiceIdsMap.has(item.provider_id)) {
            providerServiceIdsMap.set(item.provider_id, new Set());
          }

          providerServiceIdsMap.get(item.provider_id).add(item.id);
        });

        const providerBookingsMap = new Map();

        (bookingServicesRes.data || []).forEach((item) => {
          const booking = item.booking;
          if (!booking) return;

          const matchingService = (relatedServicesRes.data || []).find(
            (serviceRow) => serviceRow.id === item.service_id,
          );

          if (!matchingService?.provider_id) return;

          const providerId = matchingService.provider_id;

          if (!providerBookingsMap.has(providerId)) {
            providerBookingsMap.set(providerId, []);
          }

          providerBookingsMap.get(providerId).push({
            event_date: booking.event_date,
            status: booking.status,
            start_time: item.start_time,
            end_time: item.end_time,
          });
        });

        const filtered = scopedServices
          .filter((service) => publishedProviderIds.has(service.provider_id))
          .filter((service) =>
            isProviderAvailableForReservation({
              providerAvailabilityRows: (availabilityRes.data || []).filter(
                (item) => item.provider_id === service.provider_id,
              ),
              providerUnavailabilityRows: (unavailabilityRes.data || []).filter(
                (item) => item.provider_id === service.provider_id,
              ),
              providerBookings:
                providerBookingsMap.get(service.provider_id) || [],
              eventDate: date,
              weekday,
              startTime: time,
              endTime: reservation.endTime,
            }),
          )
          .map((service) => {
            let originLabel = "Iš bendro katalogo";
            let origin = "global";

            if (service.room_id === roomId) {
              originLabel = "Šio kambario pasiūlymas";
              origin = "room";
            } else if (venueId && service.venue_id === venueId) {
              originLabel = "Šios vietos pasiūlymas";
              origin = "venue";
            }

            return {
              ...service,
              __origin: origin,
              __originLabel: originLabel,
            };
          });

        setServices(filtered);
      } catch (err) {
        console.error(err);
        setError("Nepavyko užkrauti papildomų paslaugų.");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, date, time, duration, reservation.endTime]);

  const grouped = useMemo(() => groupServicesByType(services), [services]);

  const selectedServices = [
    selectedDecorations,
    selectedAnimator,
    selectedCake,
  ].filter(Boolean);

  const servicesTotal = selectedServices.reduce(
    (sum, item) => sum + Number(item.price_per_unit || 0),
    0,
  );

  const grandTotal = Number(roomTotal || 0) + servicesTotal;

  const continueToCheckout = () => {
    const query = new URLSearchParams(searchParams.toString());

    if (selectedDecorations) {
      query.set("decorationsId", selectedDecorations.id);
    }

    if (selectedAnimator) {
      query.set("animatorId", selectedAnimator.id);
    }

    if (selectedCake) {
      query.set("cakeId", selectedCake.id);
    }

    query.set("servicesTotal", String(servicesTotal));
    query.set("grandTotal", String(grandTotal));

    router.push(`/rezervacija?${query.toString()}`);
  };

  const continueRoomOnly = () => {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("decorationsId");
    query.delete("animatorId");
    query.delete("cakeId");
    query.delete("servicesTotal");
    query.delete("grandTotal");

    router.push(`/rezervacija?${query.toString()}`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1100px] px-[16px] py-[40px]">
        <p className="ui-font text-[14px] text-slate-500">Kraunama...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1100px] px-[16px] py-[32px] space-y-[24px]">
      <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
        <div className="flex flex-col gap-[20px] lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-[8px]">
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Papildomos paslaugos
            </p>
            <h1 className="ui-font text-[28px] font-semibold text-slate-900">
              Pasirinkite papildomas paslaugas
            </h1>
            <p className="ui-font max-w-[700px] text-[14px] leading-[22px] text-slate-600">
              Rodomos tik tos paslaugos, kurios laisvos pagal jūsų pasirinktą
              kambario rezervacijos datą ir laiką.
            </p>
          </div>

          <div className="w-full max-w-[340px] rounded-[24px] bg-slate-50 p-[18px]">
            <p className="ui-font text-[16px] font-semibold text-slate-900">
              Rezervacijos santrauka
            </p>

            <div className="mt-[12px] space-y-[8px]">
              <div className="flex items-start justify-between gap-[10px]">
                <span className="ui-font text-[13px] text-slate-500">
                  Kambarys
                </span>
                <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                  {room?.name || "-"}
                </span>
              </div>

              {venue && (
                <div className="flex items-start justify-between gap-[10px]">
                  <span className="ui-font text-[13px] text-slate-500">
                    Vieta
                  </span>
                  <span className="ui-font text-right text-[13px] text-slate-700">
                    {venue.name}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-[10px]">
                <span className="ui-font text-[13px] text-slate-500">Data</span>
                <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                  {date}
                </span>
              </div>

              <div className="flex items-start justify-between gap-[10px]">
                <span className="ui-font text-[13px] text-slate-500">
                  Laikas
                </span>
                <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                  {time} - {reservation.endTime}
                </span>
              </div>

              <div className="flex items-start justify-between gap-[10px]">
                <span className="ui-font text-[13px] text-slate-500">
                  Kambarys
                </span>
                <span className="ui-font text-right text-[13px] font-semibold text-slate-800">
                  {formatPrice(roomTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[20px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-700">{error}</p>
        </div>
      )}

      <CategorySection
        title="Dekoracijos"
        items={grouped.decorations}
        selectedId={selectedDecorations?.id}
        selectedOrigin={selectedDecorations?.__origin}
        onSelect={(item) =>
          setSelectedDecorations((prev) =>
            prev?.id === item.id && prev?.__origin === item.__origin
              ? null
              : item,
          )
        }
        emptyText="Pasirinktam laikui dekoracijų pasiūlymų neradome."
      />

      <CategorySection
        title="Animatorius"
        items={grouped.animator}
        selectedId={selectedAnimator?.id}
        selectedOrigin={selectedAnimator?.__origin}
        onSelect={(item) =>
          setSelectedAnimator((prev) =>
            prev?.id === item.id && prev?.__origin === item.__origin
              ? null
              : item,
          )
        }
        emptyText="Pasirinktam laikui animatorių pasiūlymų neradome."
      />

      <CategorySection
        title="Tortas"
        items={grouped.cake}
        selectedId={selectedCake?.id}
        selectedOrigin={selectedCake?.__origin}
        onSelect={(item) =>
          setSelectedCake((prev) =>
            prev?.id === item.id && prev?.__origin === item.__origin
              ? null
              : item,
          )
        }
        emptyText="Pasirinktam laikui tortų pasiūlymų neradome."
      />

      <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
        <div className="grid gap-[18px] lg:grid-cols-[1fr,320px] lg:items-start">
          <div>
            <h2 className="ui-font text-[20px] font-semibold text-slate-900">
              Bendra suvestinė
            </h2>

            <div className="mt-[16px] space-y-[10px]">
              <div className="flex items-start justify-between gap-[10px]">
                <span className="ui-font text-[14px] text-slate-600">
                  Kambario rezervacija
                </span>
                <span className="ui-font text-[14px] font-semibold text-slate-900">
                  {formatPrice(roomTotal)}
                </span>
              </div>

              {selectedServices.length === 0 ? (
                <p className="ui-font text-[14px] text-slate-500">
                  Papildomų paslaugų kol kas nepasirinkote.
                </p>
              ) : (
                selectedServices.map((item) => (
                  <div
                    key={`${item.__origin}-${item.id}`}
                    className="flex items-start justify-between gap-[10px]"
                  >
                    <span className="ui-font text-[14px] text-slate-600">
                      {item.name}
                    </span>
                    <span className="ui-font text-[14px] font-semibold text-slate-900">
                      {formatPrice(item.price_per_unit)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] bg-slate-50 p-[18px]">
            <div className="flex items-center justify-between gap-[10px]">
              <span className="ui-font text-[14px] text-slate-500">
                Iš viso
              </span>
              <span className="ui-font text-[28px] font-semibold text-primary">
                {formatPrice(grandTotal)}
              </span>
            </div>

            <div className="mt-[18px] space-y-[10px]">
              <button
                type="button"
                onClick={continueToCheckout}
                className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
              >
                Tęsti
              </button>

              <button
                type="button"
                onClick={continueRoomOnly}
                className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Tęsti tik su kambariu
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
