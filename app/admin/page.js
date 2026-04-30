"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import Loader from "../components/Loader";

const ROLE_OPTIONS = [
  { value: "client", label: "Klientas" },
  { value: "venue_owner", label: "Zaidimu erdves partneris" },
  { value: "service_provider", label: "Paslaugos teikejas" },
  { value: "admin", label: "Administratorius" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Laukia patvirtinimo" },
  { value: "confirmed", label: "Patvirtinta" },
  { value: "rejected", label: "Atmesta" },
  { value: "cancelled", label: "Atsaukta" },
];

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role || "-";
}

function getStatusLabel(status) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    status ||
    "Nezinoma"
  );
}

function getStatusClassName(status) {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-slate-200 text-slate-600";
    case "pending":
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function formatPrice(value) {
  if (value == null || value === "") return "-";
  return `${Number(value).toFixed(2)} EUR`;
}

function formatTimeRange(startTime, endTime) {
  const start = String(startTime || "").slice(0, 5);
  const end = String(endTime || "").slice(0, 5);
  return end ? `${start} - ${end}` : start || "-";
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function bookingMatchesSearch(booking, searchValue) {
  const query = normalizeSearchValue(searchValue);
  if (!query) return true;

  const room = booking?.room || {};
  const venue = room.venue || {};
  const fields = [
    booking?.reservation_code,
    booking?.guest_name,
    booking?.guest_email,
    booking?.guest_phone,
    room.name,
    venue.name,
  ];

  return fields.some((field) =>
    normalizeSearchValue(field).includes(query),
  );
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

function getBookingStartDate(booking) {
  if (!booking?.event_date) return null;

  const [hours, minutes] = String(booking.start_time || "00:00")
    .split(":")
    .map(Number);
  const date = new Date(booking.event_date);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function canCancelBooking(booking) {
  if (!booking || booking.status === "cancelled" || booking.status === "rejected") {
    return false;
  }

  const startDate = getBookingStartDate(booking);
  if (!startDate) return false;

  const hoursUntilBooking = (startDate.getTime() - Date.now()) / 36e5;
  return hoursUntilBooking >= 48;
}

function buildUserDrafts(rows) {
  return (rows || []).reduce((map, user) => {
    map[user.id] = {
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "client",
    };
    return map;
  }, {});
}

function buildPartnerDrafts(rows) {
  return (rows || []).reduce((map, item) => {
    map[item.id] = {
      name: item.name || "",
      city: item.city || "",
      email: item.email || "",
      phone: item.phone || "",
    };
    return map;
  }, {});
}

function buildServiceDrafts(rows) {
  return (rows || []).reduce((map, item) => {
    map[item.id] = {
      name: item.name || "",
      price_per_unit:
        item.price_per_unit == null ? "" : String(item.price_per_unit),
      is_listed: item.is_listed !== false,
    };
    return map;
  }, {});
}

function getApprovalPriority(approval) {
  const statusScore =
    approval?.status === "confirmed" || approval?.status === "rejected"
      ? 3
      : approval?.status === "cancelled"
        ? 2
        : 1;
  const respondedScore = approval?.responded_at ? 1 : 0;
  const timestamp = Date.parse(
    approval?.responded_at || approval?.created_at || "1970-01-01T00:00:00Z",
  );

  return [statusScore, respondedScore, Number.isNaN(timestamp) ? 0 : timestamp];
}

function pickBestApproval(current, candidate) {
  if (!current) return candidate;

  const a = getApprovalPriority(current);
  const b = getApprovalPriority(candidate);

  if (b[0] !== a[0]) {
    return b[0] > a[0] ? candidate : current;
  }

  if (b[1] !== a[1]) {
    return b[1] > a[1] ? candidate : current;
  }

  return b[2] >= a[2] ? candidate : current;
}

function createSyntheticRoomApproval(booking) {
  return {
    id: `synthetic-venue-${booking.id}`,
    booking_id: booking.id,
    approval_type: "venue",
    venue_id: booking.room?.venue_id || booking.room?.venue?.id || null,
    provider_id: null,
    service_id: null,
    status: booking.status || "pending",
    synthetic: true,
  };
}

function createSyntheticServiceApproval(booking, serviceRow) {
  return {
    id: `synthetic-service-${booking.id}-${serviceRow.service_id}`,
    booking_id: booking.id,
    approval_type: "service",
    venue_id: booking.room?.venue_id || booking.room?.venue?.id || null,
    provider_id: serviceRow.service?.provider_id || null,
    service_id: serviceRow.service_id,
    status: "pending",
    synthetic: true,
  };
}

function buildBookingDetails(booking) {
  const approvals = booking?.booking_approvals || [];
  const roomApproval =
    approvals
      .filter((approval) => approval.approval_type === "venue")
      .reduce((current, approval) => pickBestApproval(current, approval), null) ||
    createSyntheticRoomApproval(booking);

  const approvalsByService = approvals
    .filter((approval) => approval.approval_type === "service")
    .reduce((map, approval) => {
      const key = approval.service_id || approval.provider_id || approval.id;
      map.set(key, pickBestApproval(map.get(key), approval));
      return map;
    }, new Map());

  const serviceItems = (booking?.booking_services || []).map((item) => {
    const key = item.service_id || item.service?.provider_id || item.id;
    const approval =
      approvalsByService.get(key) || createSyntheticServiceApproval(booking, item);

    return {
      ...item,
      approval,
    };
  });

  approvals
    .filter((approval) => approval.approval_type === "service")
    .forEach((approval) => {
      const alreadyExists = serviceItems.some(
        (item) => item.service_id === approval.service_id,
      );

      if (alreadyExists) return;

      serviceItems.push({
        booking_id: booking.id,
        service_id: approval.service_id,
        price_per_unit: null,
        units_of_measure: null,
        service: approval.service || {
          id: approval.service_id,
          provider_id: approval.provider_id,
          name: "Paslauga",
        },
        approval,
      });
    });

  return {
    roomApproval,
    serviceItems,
  };
}

function getBookingSummaryStatus(booking) {
  if (!booking) return "pending";
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "rejected") return "rejected";

  const { roomApproval, serviceItems } = buildBookingDetails(booking);

  if (roomApproval?.status === "rejected") {
    return "rejected";
  }

  if (roomApproval?.status === "pending") {
    return "pending";
  }

  if (roomApproval?.status === "confirmed") {
    return "confirmed";
  }

  const serviceStatuses = serviceItems
    .map((item) => item.approval?.status)
    .filter(Boolean);

  if (
    serviceStatuses.length > 0 &&
    serviceStatuses.every((status) => status === "rejected")
  ) {
    return "rejected";
  }

  if (serviceStatuses.some((status) => status === "pending")) {
    return "pending";
  }

  if (
    serviceStatuses.length > 0 &&
    serviceStatuses.every((status) => status === "confirmed")
  ) {
    return "confirmed";
  }

  return booking.status || "pending";
}

function hasPendingDecision(booking) {
  const { roomApproval, serviceItems } = buildBookingDetails(booking);

  return (
    roomApproval?.status === "pending" ||
    serviceItems.some((item) => item.approval?.status === "pending")
  );
}

function DetailCell({ label, value }) {
  return (
    <div className="rounded-[18px] bg-slate-50 p-[12px]">
      <p className="ui-font text-[12px] text-slate-500">{label}</p>
      <p className="mt-[4px] ui-font break-words text-[14px] font-semibold text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function AdminApprovalCard({
  title,
  subtitle,
  status,
  meta,
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
              className={`ui-font inline-flex rounded-full px-[12px] py-[6px] text-[12px] font-semibold ${getStatusClassName(
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
                key={`${itemKey}-${item.label}`}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>

        <div className="min-w-[220px]">
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
        </div>
      </div>
    </article>
  );
}

function AdminReservationDetailsModal({
  booking,
  processingKey,
  onClose,
  onDecision,
}) {
  if (!booking) return null;

  const room = booking.room || {};
  const venue = room.venue || {};
  const { roomApproval, serviceItems } = buildBookingDetails(booking);
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
              {booking.event_date || "-"} -{" "}
              {formatTimeRange(booking.start_time, booking.end_time)}
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
          <AdminApprovalCard
            title={room.name || "Kambario rezervacija"}
            subtitle="Zaidimu kambario rezervacija"
            status={roomApproval.status}
            meta={[
              ["Data", booking.event_date],
              ["Laikas", formatTimeRange(booking.start_time, booking.end_time)],
              ["Statusas", getStatusLabel(roomApproval.status)],
            ].map(([label, value]) => ({ label, value }))}
            actionLabel="Patvirtinti kambari"
            processingKey={processingKey}
            itemKey={roomItemKey}
            onConfirm={() =>
              onDecision({
                bookingId: booking.id,
                approvalType: "venue",
                approval: roomApproval,
                venueId: room.venue_id || venue.id,
                nextStatus: "confirmed",
                itemKey: roomItemKey,
              })
            }
            onReject={() =>
              onDecision({
                bookingId: booking.id,
                approvalType: "venue",
                approval: roomApproval,
                venueId: room.venue_id || venue.id,
                nextStatus: "rejected",
                itemKey: roomItemKey,
              })
            }
          />

          {serviceItems.map((item) => {
            const service = item.service || {};
            const providerName = service.provider?.name || "Paslaugos teikejas";
            const itemKey = `service:${booking.id}:${item.service_id}`;

            return (
              <AdminApprovalCard
                key={itemKey}
                title={service.name || "Paslauga"}
                subtitle={`${getServiceTypeLabel(service.service_type)} - ${providerName}`}
                status={item.approval.status}
                meta={[
                  ["Tipas", getServiceTypeLabel(service.service_type)],
                  ["Tiekejas", providerName],
                  ["Kaina", formatPrice(item.price_per_unit)],
                  ["Matavimo vnt.", item.units_of_measure || "unit"],
                  [
                    "Trukme",
                    service.duration_minutes
                      ? `${service.duration_minutes} min.`
                      : "-",
                  ],
                  ["Statusas", getStatusLabel(item.approval.status)],
                ].map(([label, value]) => ({ label, value }))}
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
                    venueId: room.venue_id || venue.id,
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
                    venueId: room.venue_id || venue.id,
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

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [venues, setVenues] = useState([]);
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [activeBookingId, setActiveBookingId] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [userDrafts, setUserDrafts] = useState({});
  const [venueDrafts, setVenueDrafts] = useState({});
  const [providerDrafts, setProviderDrafts] = useState({});
  const [serviceDrafts, setServiceDrafts] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/prisijungti?next=/admin");
          return;
        }

        const { data: userRow, error: roleError } = await supabase
          .from("users")
          .select("id, email, full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (roleError) {
          throw roleError;
        }

        if (userRow?.role !== "admin") {
          router.replace(userRow?.role === "client" ? "/account" : "/partner");
          return;
        }

        setCurrentAdmin(userRow);

        const [usersRes, bookingsRes, venuesRes, providersRes, servicesRes] =
          await Promise.all([
            supabase
              .from("users")
              .select("id, email, full_name, role")
              .order("full_name", { ascending: true }),
            supabase
              .from("bookings")
              .select(
                `
                id,
                reservation_code,
                status,
                event_date,
                start_time,
                end_time,
                guest_name,
                guest_email,
                guest_phone,
                num_children,
                num_adults,
                note,
                total_price,
                total_amount,
                room:rooms (
                  id,
                  name,
                  city,
                  venue_id,
                  venue:venues (
                    id,
                    name,
                    address,
                    city
                  )
                ),
                booking_services (
                  booking_id,
                  service_id,
                  price_per_unit,
                  units_of_measure,
                  service:services (
                    id,
                    provider_id,
                    venue_id,
                    room_id,
                    name,
                    service_type,
                    duration_minutes,
                    provider:service_providers (
                      id,
                      name
                    )
                  )
                ),
                booking_approvals (
                  id,
                  booking_id,
                  approval_type,
                  venue_id,
                  provider_id,
                  service_id,
                  status,
                  responded_at,
                  created_at,
                  service:services (
                    id,
                    provider_id,
                    venue_id,
                    room_id,
                    name,
                    service_type,
                    duration_minutes,
                    provider:service_providers (
                      id,
                      name
                    )
                  )
                )
              `,
              )
              .order("event_date", { ascending: false })
              .order("start_time", { ascending: true }),
            supabase
              .from("venues")
              .select("id, name, city, email, phone, owner_id")
              .order("name", { ascending: true }),
            supabase
              .from("service_providers")
              .select("id, name, city, email, phone, owner_id")
              .order("name", { ascending: true }),
            supabase
              .from("services")
              .select(
                "id, name, service_type, price_per_unit, units_of_measure, is_listed, provider:service_providers(id, name)",
              )
              .order("name", { ascending: true }),
          ]);

        if (!isMounted) return;

        if (usersRes.error) throw usersRes.error;
        if (bookingsRes.error) throw bookingsRes.error;
        if (venuesRes.error) throw venuesRes.error;
        if (providersRes.error) throw providersRes.error;
        if (servicesRes.error) throw servicesRes.error;

        setUsers(usersRes.data || []);
        setBookings(bookingsRes.data || []);
        setVenues(venuesRes.data || []);
        setProviders(providersRes.data || []);
        setServices(servicesRes.data || []);
        setUserDrafts(buildUserDrafts(usersRes.data || []));
        setVenueDrafts(buildPartnerDrafts(venuesRes.data || []));
        setProviderDrafts(buildPartnerDrafts(providersRes.data || []));
        setServiceDrafts(buildServiceDrafts(servicesRes.data || []));
      } catch (error) {
        console.error("admin load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko uzkrauti administratoriaus duomenu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const stats = useMemo(
    () => ({
      users: users.length,
      bookings: bookings.length,
      pendingBookings: bookings.filter(hasPendingDecision).length,
      partners: venues.length + providers.length,
    }),
    [bookings, providers.length, users.length, venues.length],
  );

  const activeBooking = useMemo(
    () => bookings.find((booking) => booking.id === activeBookingId) || null,
    [activeBookingId, bookings],
  );

  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        bookingMatchesSearch(booking, reservationSearch),
      ),
    [bookings, reservationSearch],
  );

  function showSuccess(message) {
    setSuccessMsg(message);
    setErrorMsg("");
  }

  function showError(message, error) {
    if (error) {
      console.error(message, error);
    }
    setErrorMsg(message);
    setSuccessMsg("");
  }

  function updateUserDraft(userId, field, value) {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }));
  }

  function updateVenueDraft(venueId, field, value) {
    setVenueDrafts((current) => ({
      ...current,
      [venueId]: {
        ...current[venueId],
        [field]: value,
      },
    }));
  }

  function updateProviderDraft(providerId, field, value) {
    setProviderDrafts((current) => ({
      ...current,
      [providerId]: {
        ...current[providerId],
        [field]: value,
      },
    }));
  }

  function updateServiceDraft(serviceId, field, value) {
    setServiceDrafts((current) => ({
      ...current,
      [serviceId]: {
        ...current[serviceId],
        [field]: value,
      },
    }));
  }

  async function handleSaveUser(userId) {
    const draft = userDrafts[userId];
    if (!draft) return;

    setSavingKey(`user:${userId}`);

    const payload = {
      full_name: draft.full_name.trim() || null,
      email: draft.email.trim() || null,
      role: draft.role || "client",
    };

    const { error } = await supabase.from("users").update(payload).eq("id", userId);
    setSavingKey("");

    if (error) {
      showError("Nepavyko issaugoti vartotojo profilio.", error);
      return;
    }

    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, ...payload } : user)),
    );
    if (currentAdmin?.id === userId) {
      setCurrentAdmin((current) => ({ ...current, ...payload }));
    }
    showSuccess("Vartotojo profilis atnaujintas.");
  }

  async function handleDeleteUser(userId) {
    if (userId === currentAdmin?.id) {
      showError("Savo administratoriaus paskyros istrinti negalima.");
      return;
    }

    const userToDelete = users.find((user) => user.id === userId);
    const confirmed = window.confirm(
      `Ar tikrai istrinti paskyra: ${
        userToDelete?.email || userToDelete?.full_name || userId
      }?`,
    );

    if (!confirmed) return;

    setSavingKey(`delete-user:${userId}`);
    const { error } = await supabase.rpc("admin_delete_user", {
      target_user_id: userId,
    });
    setSavingKey("");

    if (error) {
      showError("Nepavyko istrinti vartotojo paskyros.", error);
      return;
    }

    setUsers((current) => current.filter((user) => user.id !== userId));
    setUserDrafts((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    showSuccess("Vartotojo paskyra istrinta.");
  }

  async function handleUpdateBookingStatus(bookingId, status) {
    setSavingKey(`booking:${bookingId}`);
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);
    setSavingKey("");

    if (error) {
      showError("Nepavyko atnaujinti rezervacijos busenos.", error);
      return;
    }

    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking,
      ),
    );
    showSuccess("Rezervacijos busena atnaujinta.");
  }

  async function saveApprovalDecision(target, nowIso) {
    const updatePayload = {
      status: target.nextStatus,
      responded_at: nowIso,
    };

    if (target.approval?.id && !target.approval.synthetic) {
      const { error } = await supabase
        .from("booking_approvals")
        .update(updatePayload)
        .eq("id", target.approval.id);

      if (!error) return null;
    }

    const insertPayload = {
      booking_id: target.bookingId,
      approval_type: target.approvalType,
      venue_id: target.venueId || null,
      provider_id: target.providerId || null,
      service_id: target.serviceId || null,
      status: target.nextStatus,
      responded_at: nowIso,
    };

    const { error } = await supabase
      .from("booking_approvals")
      .insert(insertPayload);

    return error || null;
  }

  function upsertLocalApproval(approvals, target, nowIso) {
    const nextApproval = {
      ...(target.approval || {}),
      id:
        target.approval?.id && !target.approval.synthetic
          ? target.approval.id
          : `local-${target.approvalType}-${target.bookingId}-${
              target.serviceId || target.venueId || "approval"
            }`,
      booking_id: target.bookingId,
      approval_type: target.approvalType,
      venue_id: target.venueId || null,
      provider_id: target.providerId || null,
      service_id: target.serviceId || null,
      status: target.nextStatus,
      responded_at: nowIso,
      synthetic: false,
    };

    const approvalIndex = (approvals || []).findIndex((approval) => {
      if (target.approval?.id && approval.id === target.approval.id) {
        return true;
      }

      if (target.approvalType !== approval.approval_type) {
        return false;
      }

      if (target.approvalType === "venue") {
        return (
          approval.booking_id === target.bookingId &&
          (approval.venue_id || null) === (target.venueId || null)
        );
      }

      return (
        approval.booking_id === target.bookingId &&
        (approval.service_id || null) === (target.serviceId || null) &&
        (approval.provider_id || null) === (target.providerId || null)
      );
    });

    if (approvalIndex === -1) {
      return [...(approvals || []), nextApproval];
    }

    return (approvals || []).map((approval, index) =>
      index === approvalIndex ? { ...approval, ...nextApproval } : approval,
    );
  }

  async function handleAdminDecision(target) {
    setSavingKey(target.itemKey);

    try {
      const nowIso = new Date().toISOString();
      const approvalError = await saveApprovalDecision(target, nowIso);

      if (approvalError) {
        throw approvalError;
      }

      if (target.approvalType === "venue") {
        const { error: bookingError } = await supabase
          .from("bookings")
          .update({ status: target.nextStatus })
          .eq("id", target.bookingId);

        if (bookingError) {
          throw bookingError;
        }
      }

      setBookings((current) =>
        current.map((booking) => {
          if (booking.id !== target.bookingId) {
            return booking;
          }

          return {
            ...booking,
            status:
              target.approvalType === "venue"
                ? target.nextStatus
                : booking.status,
            booking_approvals: upsertLocalApproval(
              booking.booking_approvals || [],
              target,
              nowIso,
            ),
          };
        }),
      );
      showSuccess("Rezervacijos sprendimas issaugotas.");
    } catch (error) {
      showError("Nepavyko issaugoti rezervacijos sprendimo.", error);
    } finally {
      setSavingKey("");
    }
  }

  async function handleSaveVenue(venueId) {
    const draft = venueDrafts[venueId];
    if (!draft) return;

    setSavingKey(`venue:${venueId}`);
    const payload = {
      name: draft.name.trim() || null,
      city: draft.city.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
    };
    const { error } = await supabase.from("venues").update(payload).eq("id", venueId);
    setSavingKey("");

    if (error) {
      showError("Nepavyko issaugoti zaidimu erdves.", error);
      return;
    }

    setVenues((current) =>
      current.map((venue) => (venue.id === venueId ? { ...venue, ...payload } : venue)),
    );
    showSuccess("Zaidimu erdve atnaujinta.");
  }

  async function handleSaveProvider(providerId) {
    const draft = providerDrafts[providerId];
    if (!draft) return;

    setSavingKey(`provider:${providerId}`);
    const payload = {
      name: draft.name.trim() || null,
      city: draft.city.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
    };
    const { error } = await supabase
      .from("service_providers")
      .update(payload)
      .eq("id", providerId);
    setSavingKey("");

    if (error) {
      showError("Nepavyko issaugoti paslaugos teikejo.", error);
      return;
    }

    setProviders((current) =>
      current.map((provider) =>
        provider.id === providerId ? { ...provider, ...payload } : provider,
      ),
    );
    showSuccess("Paslaugos teikejas atnaujintas.");
  }

  async function handleSaveService(serviceId) {
    const draft = serviceDrafts[serviceId];
    if (!draft) return;

    setSavingKey(`service:${serviceId}`);
    const payload = {
      name: draft.name.trim() || null,
      price_per_unit:
        draft.price_per_unit === "" ? null : Number(draft.price_per_unit),
      is_listed: Boolean(draft.is_listed),
    };
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceId);
    setSavingKey("");

    if (error) {
      showError("Nepavyko issaugoti paslaugos.", error);
      return;
    }

    setServices((current) =>
      current.map((service) =>
        service.id === serviceId ? { ...service, ...payload } : service,
      ),
    );
    showSuccess("Paslauga atnaujinta.");
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px]">
        <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
          Administravimas
        </p>
        <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
          Administratoriaus paskyra
        </h1>
        <p className="mt-[12px] ui-font max-w-[760px] text-[15px] leading-[24px] text-slate-600">
          Cia valdysite vartotoju profilius, rezervacijas, zaidimu erdves ir
          paslaugu teikejus.
        </p>
      </div>

      {(errorMsg || successMsg) && (
        <div
          className={`mb-[20px] rounded-[18px] px-[16px] py-[12px] ${
            errorMsg ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
          }`}
        >
          <p className="ui-font text-[14px]">{errorMsg || successMsg}</p>
        </div>
      )}

      <section className="mb-[24px] grid gap-[12px] md:grid-cols-4">
        {[
          ["Vartotojai", stats.users],
          ["Rezervacijos", stats.bookings],
          ["Laukia sprendimo", stats.pendingBookings],
          ["Partneriu objektai", stats.partners],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[20px] bg-white p-[16px] shadow-sm">
            <p className="ui-font text-[13px] text-slate-500">{label}</p>
            <p className="mt-[6px] ui-font text-[26px] font-semibold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="mb-[20px] flex flex-wrap gap-[10px] rounded-[22px] bg-white p-[10px] shadow-sm">
        {[
          ["users", "Vartotojai"],
          ["bookings", "Rezervacijos"],
          ["partners", "Paslaugos ir partneriai"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`ui-font rounded-[14px] px-[16px] py-[10px] text-[14px] font-semibold transition ${
              activeTab === id
                ? "bg-primary text-white"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <section className="space-y-[14px]">
          {users.map((user) => {
            const draft = userDrafts[user.id] || {};
            const isCurrentAdmin = user.id === currentAdmin?.id;

            return (
              <article
                key={user.id}
                className="rounded-[24px] bg-white p-[18px] shadow-sm"
              >
                <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
                  <div>
                    <h2 className="ui-font text-[18px] font-semibold text-slate-900">
                      {user.full_name || user.email || "Vartotojas"}
                    </h2>
                    <p className="ui-font text-[13px] text-slate-500">
                      {getRoleLabel(user.role)}
                      {isCurrentAdmin ? " - jusu paskyra" : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-[12px] md:grid-cols-[1fr,1fr,220px]">
                  <label className="ui-font text-[12px] font-semibold text-slate-500">
                    Vardas
                    <input
                      value={draft.full_name || ""}
                      onChange={(event) =>
                        updateUserDraft(user.id, "full_name", event.target.value)
                      }
                      className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                    />
                  </label>
                  <label className="ui-font text-[12px] font-semibold text-slate-500">
                    El. pastas
                    <input
                      type="email"
                      value={draft.email || ""}
                      onChange={(event) =>
                        updateUserDraft(user.id, "email", event.target.value)
                      }
                      className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                    />
                  </label>
                  <label className="ui-font text-[12px] font-semibold text-slate-500">
                    Role
                    <select
                      value={draft.role || "client"}
                      disabled={isCurrentAdmin}
                      onChange={(event) =>
                        updateUserDraft(user.id, "role", event.target.value)
                      }
                      className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-[14px] flex flex-wrap gap-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSaveUser(user.id)}
                    disabled={savingKey === `user:${user.id}`}
                    className="ui-font rounded-[14px] bg-primary px-[16px] py-[10px] text-[14px] font-semibold text-white disabled:bg-slate-300"
                  >
                    {savingKey === `user:${user.id}` ? "Saugoma..." : "Issaugoti"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={
                      isCurrentAdmin || savingKey === `delete-user:${user.id}`
                    }
                    className="ui-font rounded-[14px] border border-red-200 px-[16px] py-[10px] text-[14px] font-semibold text-red-600 disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Istrinti paskyra
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {activeTab === "bookings" && (
        <section className="space-y-[14px]">
          <div className="max-w-[420px]">
            <label className="ui-font text-[12px] font-semibold text-slate-500">
              Paieska pagal rezervacijos Nr.
              <input
                type="search"
                value={reservationSearch}
                onChange={(event) => setReservationSearch(event.target.value)}
                placeholder="Pvz. NP-202604-000123"
                className="mt-[6px] h-[42px] w-full rounded-[14px] border border-slate-200 bg-white px-[12px] text-[14px] text-slate-800 outline-none transition focus:border-primary"
              />
            </label>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-[28px] text-center">
              <p className="ui-font text-[15px] text-slate-600">
                {reservationSearch
                  ? "Pagal nurodyta paieska rezervaciju nerasta."
                  : "Rezervaciju dar nera."}
              </p>
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const room = booking.room || {};
              const venue = room.venue || {};
              const summaryStatus = getBookingSummaryStatus(booking);

              return (
                <article
                  key={booking.id}
                  className="rounded-[24px] bg-white p-[18px] shadow-sm"
                >
                  <div className="flex flex-col gap-[14px] lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-[10px]">
                        <h2 className="ui-font text-[20px] font-semibold text-slate-900">
                          {room.name || "Kambarys"}
                        </h2>
                        <span
                          className={`ui-font rounded-full px-[12px] py-[6px] text-[12px] font-semibold ${getStatusClassName(
                            summaryStatus,
                          )}`}
                        >
                          {getStatusLabel(summaryStatus)}
                        </span>
                      </div>
                      <p className="mt-[8px] ui-font text-[12px] font-semibold uppercase tracking-[0.08em] text-primary">
                        {booking.reservation_code ||
                          "Rezervacijos Nr. nepaskirtas"}
                      </p>
                      <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                        {booking.event_date || "-"} -{" "}
                        {formatTimeRange(booking.start_time, booking.end_time)}
                      </p>
                      <p className="mt-[4px] ui-font text-[14px] text-slate-500">
                        {venue.name || "-"}
                        {venue.address ? `, ${venue.address}` : ""}
                        {venue.city ? `, ${venue.city}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-col gap-[10px] sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setActiveBookingId(booking.id)}
                        className="ui-font inline-flex h-[44px] items-center justify-center rounded-[14px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                      >
                        Perziureti rezervacija
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateBookingStatus(booking.id, "cancelled")
                        }
                        disabled={
                          !canCancelBooking({
                            ...booking,
                            status: summaryStatus,
                          }) ||
                          savingKey === `booking:${booking.id}`
                        }
                        className="ui-font h-[44px] rounded-[14px] border border-red-200 px-[14px] text-[14px] font-semibold text-red-600 disabled:border-slate-200 disabled:text-slate-400"
                      >
                        Atsaukti
                      </button>
                    </div>
                  </div>

                  <div className="mt-[14px] grid gap-[10px] md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Klientas", booking.guest_name || "-"],
                      [
                        "Suma",
                        formatPrice(booking.total_amount ?? booking.total_price),
                      ],
                      ["Vaikai", booking.num_children ?? "-"],
                      ["Suauge", booking.num_adults ?? "-"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[16px] bg-slate-50 p-[12px]"
                      >
                        <p className="ui-font text-[12px] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-[4px] ui-font break-words text-[14px] font-semibold text-slate-800">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      {activeTab === "partners" && (
        <section className="grid gap-[18px] xl:grid-cols-2">
          <div className="space-y-[14px]">
            <h2 className="ui-font text-[22px] font-semibold text-slate-900">
              Zaidimu erdves
            </h2>
            {venues.map((venue) => {
              const draft = venueDrafts[venue.id] || {};
              return (
                <article
                  key={venue.id}
                  className="rounded-[24px] bg-white p-[18px] shadow-sm"
                >
                  <div className="grid gap-[10px] md:grid-cols-2">
                    {[
                      ["name", "Pavadinimas"],
                      ["city", "Miestas"],
                      ["email", "El. pastas"],
                      ["phone", "Telefonas"],
                    ].map(([field, label]) => (
                      <label
                        key={field}
                        className="ui-font text-[12px] font-semibold text-slate-500"
                      >
                        {label}
                        <input
                          value={draft[field] || ""}
                          onChange={(event) =>
                            updateVenueDraft(venue.id, field, event.target.value)
                          }
                          className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveVenue(venue.id)}
                    disabled={savingKey === `venue:${venue.id}`}
                    className="ui-font mt-[12px] rounded-[14px] bg-primary px-[16px] py-[10px] text-[14px] font-semibold text-white disabled:bg-slate-300"
                  >
                    Issaugoti erdve
                  </button>
                </article>
              );
            })}
          </div>

          <div className="space-y-[14px]">
            <h2 className="ui-font text-[22px] font-semibold text-slate-900">
              Paslaugu teikejai
            </h2>
            {providers.map((provider) => {
              const draft = providerDrafts[provider.id] || {};
              return (
                <article
                  key={provider.id}
                  className="rounded-[24px] bg-white p-[18px] shadow-sm"
                >
                  <div className="grid gap-[10px] md:grid-cols-2">
                    {[
                      ["name", "Pavadinimas"],
                      ["city", "Miestas"],
                      ["email", "El. pastas"],
                      ["phone", "Telefonas"],
                    ].map(([field, label]) => (
                      <label
                        key={field}
                        className="ui-font text-[12px] font-semibold text-slate-500"
                      >
                        {label}
                        <input
                          value={draft[field] || ""}
                          onChange={(event) =>
                            updateProviderDraft(
                              provider.id,
                              field,
                              event.target.value,
                            )
                          }
                          className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveProvider(provider.id)}
                    disabled={savingKey === `provider:${provider.id}`}
                    className="ui-font mt-[12px] rounded-[14px] bg-primary px-[16px] py-[10px] text-[14px] font-semibold text-white disabled:bg-slate-300"
                  >
                    Issaugoti teikeja
                  </button>
                </article>
              );
            })}

            <h2 className="pt-[8px] ui-font text-[22px] font-semibold text-slate-900">
              Paslaugos
            </h2>
            {services.map((service) => {
              const draft = serviceDrafts[service.id] || {};
              return (
                <article
                  key={service.id}
                  className="rounded-[24px] bg-white p-[18px] shadow-sm"
                >
                  <p className="mb-[10px] ui-font text-[13px] text-slate-500">
                    {service.provider?.name || "Teikejas nenurodytas"}
                  </p>
                  <div className="grid gap-[10px] md:grid-cols-[1fr,160px,140px]">
                    <label className="ui-font text-[12px] font-semibold text-slate-500">
                      Paslauga
                      <input
                        value={draft.name || ""}
                        onChange={(event) =>
                          updateServiceDraft(service.id, "name", event.target.value)
                        }
                        className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                      />
                    </label>
                    <label className="ui-font text-[12px] font-semibold text-slate-500">
                      Kaina
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price_per_unit || ""}
                        onChange={(event) =>
                          updateServiceDraft(
                            service.id,
                            "price_per_unit",
                            event.target.value,
                          )
                        }
                        className="mt-[6px] w-full rounded-[14px] border border-slate-200 px-[12px] py-[10px] text-[14px] text-slate-800 outline-none focus:border-primary"
                      />
                    </label>
                    <label className="ui-font flex items-end gap-[8px] text-[12px] font-semibold text-slate-500">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.is_listed)}
                        onChange={(event) =>
                          updateServiceDraft(
                            service.id,
                            "is_listed",
                            event.target.checked,
                          )
                        }
                        className="mb-[13px] h-[18px] w-[18px] accent-primary"
                      />
                      <span className="pb-[10px]">Rodoma</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveService(service.id)}
                    disabled={savingKey === `service:${service.id}`}
                    className="ui-font mt-[12px] rounded-[14px] bg-primary px-[16px] py-[10px] text-[14px] font-semibold text-white disabled:bg-slate-300"
                  >
                    Issaugoti paslauga
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <AdminReservationDetailsModal
        booking={activeBooking}
        processingKey={savingKey}
        onClose={() => setActiveBookingId("")}
        onDecision={handleAdminDecision}
      />
    </main>
  );
}
