"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  buildReservationInterval,
  groupServicesByType,
  isProviderAvailableForReservation,
} from "../../lib/serviceAvailability";
import { mapServiceImagesWithUrls } from "../../lib/serviceImageUtils";
import ServiceDetailsModal from "../../components/ServiceDetailsModal";

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function getWeekdayFromDateString(dateStr) {
  return new Date(dateStr).getDay();
}

function ServiceCard({ item, isSelected, onSelect, onOpenDetails }) {
  return (
    <div
      className={`overflow-hidden rounded-[22px] border transition ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
      }`}
    >
      <div className="overflow-hidden bg-slate-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.image_alt || item.name}
            className="h-[180px] w-full object-cover"
          />
        ) : (
          <div className="flex h-[180px] items-center justify-center">
            <span className="ui-font text-[14px] text-slate-400">
              Nuotrauka ruošiama
            </span>
          </div>
        )}
      </div>

      <div className="p-[16px]">
        <div className="mb-[10px] flex items-start justify-between gap-[12px]">
          <div>
            <p className="ui-font text-[16px] font-semibold text-slate-900">
              {item.name}
            </p>
            <p className="ui-font mt-[4px] text-[13px] text-slate-500">
              Tiekėjas: {item.provider_name || "Nenurodytas"}
            </p>
          </div>

          <span className="ui-font whitespace-nowrap rounded-full bg-amber-50 px-[10px] py-[5px] text-[12px] font-semibold text-amber-700">
            {formatPrice(item.price_per_unit)}
          </span>
        </div>

        <div className="mb-[10px] flex flex-wrap gap-[8px]">
          <span className="ui-font rounded-full bg-slate-100 px-[10px] py-[5px] text-[12px] text-slate-600">
            {item.__originLabel}
          </span>

          <span className="ui-font rounded-full bg-slate-100 px-[10px] py-[5px] text-[12px] text-slate-600">
            Matavimo vienetas: {item.units_of_measure || "unit"}
          </span>
        </div>

        {(item.short_description || item.description) && (
          <p className="ui-font text-[13px] leading-[20px] text-slate-600">
            {item.short_description || item.description}
          </p>
        )}

        <div className="mt-[16px] grid grid-cols-2 gap-[10px]">
          <button
            type="button"
            onClick={() => onOpenDetails(item)}
            className="ui-font inline-flex h-[42px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[12px] text-[14px] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Plačiau
          </button>

          <button
            type="button"
            onClick={() => onSelect(item)}
            className={`ui-font inline-flex h-[42px] items-center justify-center rounded-[16px] px-[12px] text-[14px] font-medium transition ${
              isSelected
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {isSelected ? "Pasirinkta" : "Pasirinkti"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  title,
  items,
  selectedId,
  selectedOrigin,
  onSelect,
  onOpenDetails,
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
            <ServiceCard
              key={`${item.__origin}-${item.id}`}
              item={item}
              isSelected={isSelected}
              onSelect={onSelect}
              onOpenDetails={onOpenDetails}
            />
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

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsService, setDetailsService] = useState(null);

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
            `
            id,
            provider_id,
            room_id,
            venue_id,
            name,
            description,
            short_description,
            full_description,
            ingredients,
            includes_text,
            notes,
            service_type,
            price_per_unit,
            units_of_measure,
            is_global,
            is_listed,
            sort_order,
            provider:service_providers!services_provider_id_fkey (
              id,
              name,
              is_published
            )
          `,
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
            (item.service_type === "decorations" ||
              item.service_type === "animator" ||
              item.service_type === "cake") &&
            item.provider?.is_published === true,
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
          availabilityRes,
          unavailabilityRes,
          relatedServicesRes,
          bookingServicesRes,
          serviceImagesRes,
        ] = await Promise.all([
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

          supabase
            .from("service_images")
            .select("id, service_id, path, alt_text, is_primary, position")
            .in("service_id", candidateServiceIds),
        ]);

        if (availabilityRes.error) throw availabilityRes.error;
        if (unavailabilityRes.error) throw unavailabilityRes.error;
        if (relatedServicesRes.error) throw relatedServicesRes.error;
        if (bookingServicesRes.error) throw bookingServicesRes.error;
        if (serviceImagesRes.error) throw serviceImagesRes.error;

        const mappedImages = mapServiceImagesWithUrls({
          supabase,
          images: serviceImagesRes.data || [],
        });

        const imagesByServiceId = new Map();

        mappedImages.forEach((img) => {
          if (!imagesByServiceId.has(img.service_id)) {
            imagesByServiceId.set(img.service_id, []);
          }

          imagesByServiceId.get(img.service_id).push({
            url: img.imageUrl,
            alt: img.alt_text || "",
            is_primary: img.is_primary,
            position: img.position ?? 9999,
          });
        });

        for (const [serviceId, imageList] of imagesByServiceId.entries()) {
          imageList.sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.position ?? 9999) - (b.position ?? 9999);
          });

          imagesByServiceId.set(serviceId, imageList);
        }

        const providerBookingsMap = new Map();
        const relatedServicesMap = new Map(
          (relatedServicesRes.data || []).map((item) => [item.id, item]),
        );

        (bookingServicesRes.data || []).forEach((item) => {
          const booking = item.booking;
          if (!booking) return;

          const matchingService = relatedServicesMap.get(item.service_id);
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
            let originLabel = "Platformos partneris";
            let origin = "global";

            if (service.room_id === roomId) {
              originLabel = "Šio kambario pasiūlymas";
              origin = "room";
            } else if (venueId && service.venue_id === venueId) {
              originLabel = "Šios vietos pasiūlymas";
              origin = "venue";
            }

            const images = imagesByServiceId.get(service.id) || [];
            const primaryImage = images[0] || null;

            return {
              ...service,
              provider_name: service.provider?.name || "Nenurodytas",
              image_url: primaryImage?.url || null,
              image_alt: primaryImage?.alt || service.name,
              images,
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

  const openDetails = (service) => {
    setDetailsService(service);
    setDetailsOpen(true);
  };

  const handleSelectService = (service) => {
    if (service.service_type === "decorations") {
      setSelectedDecorations((prev) =>
        prev?.id === service.id && prev?.__origin === service.__origin
          ? null
          : service,
      );
    }

    if (service.service_type === "animator") {
      setSelectedAnimator((prev) =>
        prev?.id === service.id && prev?.__origin === service.__origin
          ? null
          : service,
      );
    }

    if (service.service_type === "cake") {
      setSelectedCake((prev) =>
        prev?.id === service.id && prev?.__origin === service.__origin
          ? null
          : service,
      );
    }
  };

  const handleSelectFromModal = (service) => {
    handleSelectService(service);
    setDetailsOpen(false);
    setDetailsService(null);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1100px] px-[16px] py-[40px]">
        <p className="ui-font text-[14px] text-slate-500">Kraunama...</p>
      </main>
    );
  }

  return (
    <>
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
                  <span className="ui-font text-[13px] text-slate-500">
                    Data
                  </span>
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
          onSelect={handleSelectService}
          onOpenDetails={openDetails}
          emptyText="Pasirinktam laikui dekoracijų pasiūlymų neradome."
        />

        <CategorySection
          title="Animatorius"
          items={grouped.animator}
          selectedId={selectedAnimator?.id}
          selectedOrigin={selectedAnimator?.__origin}
          onSelect={handleSelectService}
          onOpenDetails={openDetails}
          emptyText="Pasirinktam laikui animatorių pasiūlymų neradome."
        />

        <CategorySection
          title="Tortas"
          items={grouped.cake}
          selectedId={selectedCake?.id}
          selectedOrigin={selectedCake?.__origin}
          onSelect={handleSelectService}
          onOpenDetails={openDetails}
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

      <ServiceDetailsModal
        open={detailsOpen}
        service={detailsService}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsService(null);
        }}
        onSelect={handleSelectFromModal}
      />
    </>
  );
}
