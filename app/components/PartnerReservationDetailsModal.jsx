"use client";

function getStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Laukia patvirtinimo";
    case "confirmed":
      return "Patvirtinta";
    case "rejected":
      return "Atmesta";
    case "cancelled":
      return "Atsaukta";
    default:
      return status || "Nezinoma";
  }
}

function getStatusClassName(status) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "confirmed":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getServiceTypeLabel(type) {
  switch (type) {
    case "decorations":
      return "Dekoracijos";
    case "animator":
      return "Animatorius";
    case "cake":
      return "Tortas";
    default:
      return type || "Paslauga";
  }
}

function formatPrice(value) {
  if (value == null) return "-";
  return `${Number(value).toFixed(2)} EUR`;
}

function DetailCell({ label, value }) {
  return (
    <div className="rounded-[18px] bg-slate-50 p-[12px]">
      <p className="ui-font text-[12px] text-slate-500">{label}</p>
      <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function ItemCard({
  title,
  subtitle,
  status,
  meta,
  canManage,
  actionLabel,
  processingKey,
  itemKey,
  onConfirm,
  onReject,
}) {
  const isProcessing = processingKey === itemKey;

  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-[16px]">
      <div className="flex flex-col gap-[14px] lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-[12px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <h3 className="ui-font text-[18px] font-semibold text-slate-900">
              {title}
            </h3>
            <span
              className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getStatusClassName(
                status,
              )}`}
            >
              {getStatusLabel(status)}
            </span>
          </div>

          {subtitle && (
            <p className="ui-font text-[14px] text-slate-500">{subtitle}</p>
          )}

          <div className="grid gap-[10px] md:grid-cols-2 xl:grid-cols-3">
            {meta.map((item) => (
              <DetailCell
                key={`${title}-${item.label}`}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>

        <div className="min-w-[220px]">
          {canManage ? (
            <div className="flex flex-col gap-[10px]">
              <button
                type="button"
                disabled={isProcessing || status !== "pending"}
                onClick={onConfirm}
                className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isProcessing ? "Saugoma..." : actionLabel}
              </button>
              <button
                type="button"
                disabled={isProcessing || status !== "pending"}
                onClick={onReject}
                className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-red-200 bg-white px-[16px] text-[14px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                {isProcessing ? "Saugoma..." : "Atmesti"}
              </button>
            </div>
          ) : (
            <div className="rounded-[18px] bg-slate-50 px-[14px] py-[12px]">
              <p className="ui-font text-[13px] leading-[20px] text-slate-500">
                Si dalis rodoma perziurai. Tvirtinti gali tik atsakingas
                partneris.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PartnerReservationDetailsModal({
  open,
  order,
  venueId,
  providerId,
  processingKey,
  onClose,
  onDecision,
}) {
  if (!open || !order) return null;

  const booking = order.booking || {};
  const room = booking.room || {};
  const venue = room.venue || {};
  const roomCanManage = Boolean(venueId && room.venue_id === venueId);
  const roomItemKey = `venue:${booking.id}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/45 px-[16px] py-[28px]">
      <section className="w-full max-w-[1100px] rounded-[28px] bg-white p-[22px] shadow-xl">
        <div className="mb-[18px] flex items-start justify-between gap-[16px]">
          <div>
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Rezervacijos detales
            </p>
            <h2 className="mt-[6px] ui-font text-[26px] font-semibold text-slate-900">
              {room.name || "Kambarys"}
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              {booking.event_date || "-"} {String(booking.start_time || "").slice(0, 5)}
              {booking.end_time
                ? ` - ${String(booking.end_time).slice(0, 5)}`
                : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-font flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] text-slate-600 transition hover:bg-slate-50"
            aria-label="Uzdaryti"
          >
            x
          </button>
        </div>

        <div className="grid gap-[10px] md:grid-cols-2 xl:grid-cols-4">
          <DetailCell
            label="Rezervacijos Nr."
            value={booking.reservation_code}
          />
          <DetailCell label="Klientas" value={booking.guest_name} />
          <DetailCell label="El. pastas" value={booking.guest_email} />
          <DetailCell label="Telefonas" value={booking.guest_phone} />
          <DetailCell
            label="Bendra suma"
            value={formatPrice(booking.total_amount ?? booking.total_price)}
          />
          <DetailCell label="Vaikai" value={booking.num_children ?? 0} />
          <DetailCell label="Suauge" value={booking.num_adults ?? 0} />
          <DetailCell label="Vieta" value={venue.name || room.city} />
          <DetailCell
            label="Adresas"
            value={
              [venue.address, venue.city].filter(Boolean).join(", ") || room.city
            }
          />
        </div>

        {booking.note && (
          <div className="mt-[16px] rounded-[20px] bg-slate-50 p-[14px]">
            <p className="ui-font text-[12px] text-slate-500">Kliento pastaba</p>
            <p className="mt-[6px] ui-font text-[14px] leading-[22px] text-slate-700">
              {booking.note}
            </p>
          </div>
        )}

        <div className="mt-[22px] space-y-[14px]">
          <ItemCard
            title={room.name || "Kambario rezervacija"}
            subtitle="Zaidimu kambario rezervacija"
            status={order.roomApproval.status}
            meta={[
              {
                label: "Laikas",
                value: `${String(booking.start_time || "").slice(0, 5)}${
                  booking.end_time
                    ? ` - ${String(booking.end_time).slice(0, 5)}`
                    : ""
                }`,
              },
              {
                label: "Data",
                value: booking.event_date,
              },
              {
                label: "Statusas",
                value: getStatusLabel(order.roomApproval.status),
              },
            ]}
            canManage={roomCanManage}
            actionLabel="Patvirtinti kambari"
            processingKey={processingKey}
            itemKey={roomItemKey}
            onConfirm={() =>
              onDecision({
                bookingId: booking.id,
                approvalType: "venue",
                approval: order.roomApproval,
                venueId: room.venue_id,
                nextStatus: "confirmed",
                itemKey: roomItemKey,
              })
            }
            onReject={() =>
              onDecision({
                bookingId: booking.id,
                approvalType: "venue",
                approval: order.roomApproval,
                venueId: room.venue_id,
                nextStatus: "rejected",
                itemKey: roomItemKey,
              })
            }
          />

          {order.services.map((item) => {
            const service = item.service || {};
            const providerName =
              service.provider?.name ||
              (service.room_id ? "Si vieta" : "Partneris");
            const serviceCanManage = Boolean(
              providerId && service.provider_id === providerId,
            );
            const itemKey = `service:${booking.id}:${item.service_id}`;

            return (
              <ItemCard
                key={itemKey}
                title={service.name || "Paslauga"}
                subtitle={`${getServiceTypeLabel(service.service_type)} - ${providerName}`}
                status={item.approval.status}
                meta={[
                  {
                    label: "Tipas",
                    value: getServiceTypeLabel(service.service_type),
                  },
                  {
                    label: "Tiekejas",
                    value: providerName,
                  },
                  {
                    label: "Kaina",
                    value: formatPrice(item.price_per_unit),
                  },
                  {
                    label: "Matavimo vnt.",
                    value: item.units_of_measure || "unit",
                  },
                  {
                    label: "Trukme",
                    value: service.duration_minutes
                      ? `${service.duration_minutes} min.`
                      : "-",
                  },
                  {
                    label: "Statusas",
                    value: getStatusLabel(item.approval.status),
                  },
                ]}
                canManage={serviceCanManage}
                actionLabel="Patvirtinti paslauga"
                processingKey={processingKey}
                itemKey={itemKey}
                onConfirm={() =>
                  onDecision({
                    bookingId: booking.id,
                    approvalType: "service",
                    approval: item.approval,
                    serviceId: item.service_id,
                    providerId: service.provider_id,
                    venueId: room.venue_id,
                    nextStatus: "confirmed",
                    itemKey,
                  })
                }
                onReject={() =>
                  onDecision({
                    bookingId: booking.id,
                    approvalType: "service",
                    approval: item.approval,
                    serviceId: item.service_id,
                    providerId: service.provider_id,
                    venueId: room.venue_id,
                    nextStatus: "rejected",
                    itemKey,
                  })
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
