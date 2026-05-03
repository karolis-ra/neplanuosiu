"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";
import PartnerReservationDetailsModal from "../../components/PartnerReservationDetailsModal";
import { notifyBookingDecision } from "../../lib/emailNotifications";

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

function formatPrice(value) {
  if (value == null) return "-";
  return `${Number(value).toFixed(2)} EUR`;
}

function formatTimeRange(startTime, endTime) {
  const start = String(startTime || "").slice(0, 5);
  const end = String(endTime || "").slice(0, 5);
  return end ? `${start} - ${end}` : start || "-";
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function orderMatchesSearch(order, searchValue) {
  const query = normalizeSearchValue(searchValue);
  if (!query) return true;

  const booking = order?.booking || {};
  const room = booking.room || {};
  const venue = room.venue || {};
  const fields = [
    booking.reservation_code,
    booking.guest_name,
    booking.guest_email,
    booking.guest_phone,
    room.name,
    venue.name,
  ];

  return fields.some((field) => normalizeSearchValue(field).includes(query));
}

function createSyntheticRoomApproval(booking) {
  return {
    id: `synthetic-venue-${booking.id}`,
    booking_id: booking.id,
    approval_type: "venue",
    venue_id: booking.room?.venue_id || null,
    provider_id: null,
    service_id: null,
    status: booking.status || "pending",
    responded_at: null,
    created_at: booking.created_at || null,
    synthetic: true,
  };
}

function createSyntheticServiceApproval(booking, serviceRow) {
  return {
    id: `synthetic-service-${booking.id}-${serviceRow.service_id}`,
    booking_id: booking.id,
    approval_type: "service",
    venue_id: booking.room?.venue_id || null,
    provider_id: serviceRow.service?.provider_id || null,
    service_id: serviceRow.service_id,
    status: "pending",
    responded_at: null,
    created_at: booking.created_at || null,
    synthetic: true,
  };
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

function getPartnerReservationSeenStorageKey(userId) {
  return `seen_partner_reservations:${userId}`;
}

function getPartnerPendingServiceKey({ bookingId, serviceId, approval }) {
  return `service:${bookingId}:${serviceId || "none"}:${
    approval?.id || approval?.provider_id || "none"
  }`;
}

function getPartnerPendingVenueKey({ booking, approval }) {
  return `venue:${booking.id}:${
    approval?.id || approval?.venue_id || booking.room?.venue_id || "booking"
  }`;
}

function getPendingPartnerReservationKeys(orders) {
  return (orders || []).flatMap((order) => {
    const keys = [];
    const booking = order.booking || {};

    if (order.viewerCanManageRoom && order.roomApproval?.status === "pending") {
      keys.push(
        getPartnerPendingVenueKey({
          booking,
          approval: order.roomApproval,
        }),
      );
    }

    (order.services || []).forEach((item) => {
      if (item.canManage && item.approval?.status === "pending") {
        keys.push(
          getPartnerPendingServiceKey({
            bookingId: booking.id,
            serviceId: item.service_id,
            approval: item.approval,
          }),
        );
      }
    });

    return keys;
  });
}

function markPendingPartnerReservationsSeen(userId, orders) {
  if (typeof window === "undefined" || !userId) return;

  const keys = getPendingPartnerReservationKeys(orders);
  if (!keys.length) return;

  let currentSeen = {};

  try {
    currentSeen = JSON.parse(
      localStorage.getItem(getPartnerReservationSeenStorageKey(userId)) || "{}",
    );
  } catch {
    currentSeen = {};
  }

  const nextSeen = keys.reduce(
    (map, key) => ({
      ...map,
      [key]: true,
    }),
    currentSeen,
  );

  localStorage.setItem(
    getPartnerReservationSeenStorageKey(userId),
    JSON.stringify(nextSeen),
  );

  window.dispatchEvent(new CustomEvent("partner-reservations-changed"));
}

async function saveApprovalDecision({ target, nowIso, nextStatus }) {
  const updatePayload = {
    status: nextStatus,
    responded_at: nowIso,
  };

  async function updateApproval(buildQuery) {
    const { error } = await buildQuery(
      supabase.from("booking_approvals").update(updatePayload),
    );

    return error || null;
  }

  let lastError = null;

  if (target.approval?.id && !target.approval.synthetic) {
    const byIdError = await updateApproval((query) =>
      query.eq("id", target.approval.id),
    );

    if (!byIdError) {
      return null;
    }

    lastError = byIdError;
  }

  if (target.approval?.synthetic) {
    const insertError = await insertApprovalDecision({
      target,
      nowIso,
      nextStatus,
    });

    if (!insertError) {
      return null;
    }

    if (insertError.code !== "23505") {
      return insertError;
    }

    lastError = insertError;
  }

  const updateAttempts =
    target.approvalType === "venue"
      ? [
          target.venueId
            ? (query) =>
                query
                  .eq("booking_id", target.bookingId)
                  .eq("approval_type", "venue")
                  .eq("venue_id", target.venueId)
            : null,
          (query) =>
            query
              .eq("booking_id", target.bookingId)
              .eq("approval_type", "venue"),
        ].filter(Boolean)
      : [
          target.serviceId && target.providerId
            ? (query) =>
                query
                  .eq("booking_id", target.bookingId)
                  .eq("approval_type", "service")
                  .eq("service_id", target.serviceId)
                  .eq("provider_id", target.providerId)
            : null,
          target.serviceId
            ? (query) =>
                query
                  .eq("booking_id", target.bookingId)
                  .eq("approval_type", "service")
                  .eq("service_id", target.serviceId)
            : null,
          target.providerId
            ? (query) =>
                query
                  .eq("booking_id", target.bookingId)
                  .eq("approval_type", "service")
                  .eq("provider_id", target.providerId)
            : null,
        ].filter(Boolean);

  for (const attempt of updateAttempts) {
    const updateError = await updateApproval(attempt);

    if (!updateError) {
      return null;
    }

    lastError = updateError;
  }

  const insertError = await insertApprovalDecision({
    target,
    nowIso,
    nextStatus,
  });

  return insertError || lastError || null;
}

async function insertApprovalDecision({ target, nowIso, nextStatus }) {
  const { error: insertError } = await supabase
    .from("booking_approvals")
    .insert({
      booking_id: target.bookingId,
      approval_type: target.approvalType,
      venue_id: target.venueId || null,
      status: nextStatus,
      responded_at: nowIso,
      ...(target.providerId ? { provider_id: target.providerId } : {}),
      ...(target.serviceId ? { service_id: target.serviceId } : {}),
    });

  return insertError || null;
}

function decorateOrder(order, venueId, providerId) {
  const viewerCanManageRoom = Boolean(
    venueId && order.booking?.room?.venue_id === venueId,
  );

  const services = (order.services || []).map((item) => ({
    ...item,
    canManage: Boolean(providerId && item.service?.provider_id === providerId),
  }));

  const pendingForViewer =
    (viewerCanManageRoom && order.roomApproval.status === "pending") ||
    services.some(
      (item) => item.canManage && item.approval.status === "pending",
    );

  const manageableServices = services.filter((item) => item.canManage);
  const serviceStatusForViewer =
    manageableServices.length === 0
      ? null
      : manageableServices.some((item) => item.approval.status === "pending")
        ? "pending"
        : manageableServices.some((item) => item.approval.status === "rejected")
          ? "rejected"
          : manageableServices.every(
                (item) => item.approval.status === "confirmed",
              )
            ? "confirmed"
            : "pending";

  const summaryStatus = viewerCanManageRoom
    ? order.roomApproval.status || "pending"
    : serviceStatusForViewer || order.roomApproval.status || "pending";

  return {
    ...order,
    viewerCanManageRoom,
    services,
    pendingForViewer,
    summaryStatus,
  };
}

function buildOrders({
  bookings,
  bookingServices,
  approvals,
  venueId,
  providerId,
}) {
  const approvalsByBooking = new Map();
  const servicesByBooking = new Map();
  const bookingsById = new Map(
    (bookings || []).map((booking) => [booking.id, booking]),
  );

  (approvals || []).forEach((approval) => {
    if (approval.booking && !bookingsById.has(approval.booking_id)) {
      bookingsById.set(approval.booking_id, {
        id: approval.booking_id,
        ...approval.booking,
      });
    } else if (approval.booking) {
      const currentBooking = bookingsById.get(approval.booking_id);
      bookingsById.set(approval.booking_id, {
        ...approval.booking,
        ...currentBooking,
        room: currentBooking?.room || approval.booking.room || null,
      });
    }

    if (!approvalsByBooking.has(approval.booking_id)) {
      approvalsByBooking.set(approval.booking_id, new Map());
    }

    const approvalKey =
      approval.approval_type === "service"
        ? `service:${approval.service_id}`
        : `venue:${approval.venue_id || "none"}`;

    const current = approvalsByBooking
      .get(approval.booking_id)
      .get(approvalKey);
    approvalsByBooking
      .get(approval.booking_id)
      .set(approvalKey, pickBestApproval(current, approval));
  });

  (bookingServices || []).forEach((item) => {
    if (!servicesByBooking.has(item.booking_id)) {
      servicesByBooking.set(item.booking_id, []);
    }

    servicesByBooking.get(item.booking_id).push(item);

    if (item.booking && !bookingsById.has(item.booking_id)) {
      bookingsById.set(item.booking_id, {
        id: item.booking_id,
        ...item.booking,
      });
    } else if (item.booking) {
      const currentBooking = bookingsById.get(item.booking_id);
      bookingsById.set(item.booking_id, {
        ...item.booking,
        ...currentBooking,
        room: currentBooking?.room || item.booking.room || null,
      });
    }
  });

  (approvals || []).forEach((approval) => {
    if (!bookingsById.has(approval.booking_id)) {
      bookingsById.set(approval.booking_id, {
        id: approval.booking_id,
        status: "pending",
        created_at: approval.created_at || null,
        room: null,
      });
    }
  });

  return [...bookingsById.values()]
    .map((booking) => {
      const approvalRows = Array.from(
        approvalsByBooking.get(booking.id)?.values() || [],
      );
      const roomApproval =
        approvalRows.find((item) => item.approval_type === "venue") ||
        createSyntheticRoomApproval(booking);

      const serviceItems = (servicesByBooking.get(booking.id) || []).map(
        (serviceRow) => {
          const approval =
            approvalRows.find(
              (item) =>
                item.approval_type === "service" &&
                item.service_id === serviceRow.service_id,
            ) || createSyntheticServiceApproval(booking, serviceRow);

          return {
            ...serviceRow,
            approval,
          };
        },
      );

      approvalRows
        .filter((approval) => approval.approval_type === "service")
        .forEach((approval) => {
          const alreadyHasService = serviceItems.some(
            (item) => item.service_id === approval.service_id,
          );

          if (alreadyHasService) {
            return;
          }

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

      return decorateOrder(
        {
          id: booking.id,
          booking,
          roomApproval,
          services: serviceItems,
        },
        venueId,
        providerId,
      );
    })
    .sort((a, b) => {
      const dateA = a.booking?.event_date || "";
      const dateB = b.booking?.event_date || "";
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;

      const timeA = a.booking?.start_time || "";
      const timeB = b.booking?.start_time || "";
      if (timeA < timeB) return -1;
      if (timeA > timeB) return 1;

      return 0;
    });
}

export default function PartnerReservationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [venue, setVenue] = useState(null);
  const [provider, setProvider] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState("");
  const [processingKey, setProcessingKey] = useState("");
  const [processedTab, setProcessedTab] = useState("confirmed");
  const [reservationSearch, setReservationSearch] = useState("");
  const [processedDateFrom, setProcessedDateFrom] = useState("");
  const [processedDateTo, setProcessedDateTo] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReservations() {
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

        const [
          { data: venueRow, error: venueError },
          { data: providerRow, error: providerError },
        ] = await Promise.all([
          supabase
            .from("venues")
            .select("id, name, city")
            .eq("owner_id", user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("service_providers")
            .select("id, name, city")
            .eq("owner_id", user.id)
            .limit(1)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (venueError) throw venueError;
        if (providerError) throw providerError;

        if (!venueRow && !providerRow) {
          router.replace("/partner");
          return;
        }

        setVenue(venueRow || null);
        setProvider(providerRow || null);

        const bookingIdSet = new Set();

        if (venueRow?.id) {
          const { data: venueBookingRows, error: venueBookingsError } =
            await supabase
              .from("bookings")
              .select("id, room:rooms!inner(venue_id)")
              .eq("room.venue_id", venueRow.id);

          if (!isMounted) return;
          if (venueBookingsError) throw venueBookingsError;

          (venueBookingRows || []).forEach((row) => {
            if (row.id) {
              bookingIdSet.add(row.id);
            }
          });
        }

        if (providerRow?.id) {
          const [
            { data: providerBookingRows, error: providerBookingsError },
            { data: providerApprovalRows, error: providerApprovalsError },
          ] = await Promise.all([
            supabase
              .from("booking_services")
              .select(
                `
                booking_id,
                service:services!inner (
                  provider_id
                )
              `,
              )
              .eq("service.provider_id", providerRow.id),
            supabase
              .from("booking_approvals")
              .select("booking_id")
              .eq("approval_type", "service")
              .eq("provider_id", providerRow.id),
          ]);

          if (!isMounted) return;
          if (providerBookingsError) throw providerBookingsError;
          if (providerApprovalsError) throw providerApprovalsError;

          (providerBookingRows || []).forEach((row) => {
            if (row.booking_id) {
              bookingIdSet.add(row.booking_id);
            }
          });

          (providerApprovalRows || []).forEach((row) => {
            if (row.booking_id) {
              bookingIdSet.add(row.booking_id);
            }
          });
        }

        const bookingIds = Array.from(bookingIdSet);

        if (!bookingIds.length) {
          setOrders([]);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("partner-reservations-changed"),
            );
          }
          return;
        }

        const [bookingsRes, bookingServicesRes, approvalsRes] =
          await Promise.all([
            supabase
              .from("bookings")
              .select(
                `
              id,
              reservation_code,
              room_id,
              status,
              event_date,
              start_time,
              end_time,
              created_at,
              guest_name,
              guest_email,
              guest_phone,
              note,
              num_children,
              num_adults,
              total_price,
              total_amount,
              room:rooms (
                id,
                name,
                city,
                venue_id,
                venue:venues (
                  name,
                  address,
                  city
                )
              )
            `,
              )
              .in("id", bookingIds),
            supabase
              .from("booking_services")
              .select(
                `
              booking_id,
              service_id,
              price_per_unit,
              units_of_measure,
              booking:bookings!booking_services_booking_id_fkey (
                id,
                reservation_code,
                room_id,
                status,
                event_date,
                start_time,
                end_time,
                created_at,
                guest_name,
                guest_email,
                guest_phone,
                note,
                num_children,
                num_adults,
                total_price,
                total_amount,
                room:rooms (
                  id,
                  name,
                  city,
                  venue_id,
                  venue:venues (
                    name,
                    address,
                    city
                  )
                )
              ),
              service:services (
                id,
                provider_id,
                venue_id,
                room_id,
                name,
                service_type,
                short_description,
                duration_minutes,
                provider:service_providers (
                  id,
                  name
                )
              )
            `,
              )
              .in("booking_id", bookingIds),
            supabase
              .from("booking_approvals")
              .select(
                `
              id,
              booking_id,
              approval_type,
              venue_id,
              provider_id,
              service_id,
              booking:bookings!booking_approvals_booking_id_fkey (
                id,
                reservation_code,
                room_id,
                status,
                event_date,
                start_time,
                end_time,
                created_at,
                guest_name,
                guest_email,
                guest_phone,
                note,
                num_children,
                num_adults,
                total_price,
                total_amount,
                room:rooms (
                  id,
                  name,
                  city,
                  venue_id,
                  venue:venues (
                    name,
                    address,
                    city
                  )
                )
              ),
              service:services (
                id,
                provider_id,
                venue_id,
                room_id,
                name,
                service_type,
                short_description,
                duration_minutes,
                provider:service_providers (
                  id,
                  name
                )
              ),
              status,
              responded_at,
              created_at
            `,
              )
              .in("booking_id", bookingIds),
          ]);

        if (!isMounted) return;

        if (bookingsRes.error) throw bookingsRes.error;
        if (bookingServicesRes.error) throw bookingServicesRes.error;
        if (approvalsRes.error) throw approvalsRes.error;

        const nextOrders = buildOrders({
          bookings: bookingsRes.data || [],
          bookingServices: bookingServicesRes.data || [],
          approvals: approvalsRes.data || [],
          venueId: venueRow?.id || null,
          providerId: providerRow?.id || null,
        });

        setOrders(nextOrders);
        markPendingPartnerReservationsSeen(user.id, nextOrders);
      } catch (error) {
        console.error("partner reservations load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko uzkrauti rezervaciju uzklausu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadReservations();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleDecision(target) {
    setProcessingKey(target.itemKey);
    setErrorMsg("");

    try {
      const nowIso = new Date().toISOString();
      const currentOrder = orders.find(
        (order) => order.id === target.bookingId,
      );
      const approvalError = await saveApprovalDecision({
        target,
        nowIso,
        nextStatus: target.nextStatus,
      });

      if (target.approvalType === "venue") {
        const { error: bookingUpdateError } = await supabase
          .from("bookings")
          .update({ status: target.nextStatus })
          .eq("id", target.bookingId);

        if (bookingUpdateError) {
          throw bookingUpdateError;
        }

        if (approvalError) {
          throw approvalError;
        }

        if (
          target.nextStatus === "rejected" &&
          currentOrder?.services?.length
        ) {
          const serviceErrors = await Promise.all(
            currentOrder.services.map((item) =>
              saveApprovalDecision({
                target: {
                  bookingId: target.bookingId,
                  approvalType: "service",
                  approval: item.approval,
                  serviceId: item.service_id,
                  providerId: item.service?.provider_id,
                  venueId: target.venueId,
                  nextStatus: "rejected",
                  itemKey: `service:${target.bookingId}:${item.service_id}`,
                },
                nowIso,
                nextStatus: "rejected",
              }),
            ),
          );
          const serviceError = serviceErrors.find(Boolean);

          if (serviceError) {
            throw serviceError;
          }
        }
      } else if (approvalError) {
        throw approvalError;
      }

      setOrders((current) =>
        current.map((order) => {
          if (order.id !== target.bookingId) {
            return order;
          }

          const nextRoomApproval =
            target.approvalType === "venue"
              ? {
                  ...order.roomApproval,
                  status: target.nextStatus,
                  responded_at: nowIso,
                  synthetic: false,
                }
              : order.roomApproval;

          const nextServices = order.services.map((item) => {
            const shouldUpdateService =
              (target.approvalType === "service" &&
                item.service_id === target.serviceId) ||
              (target.approvalType === "venue" &&
                target.nextStatus === "rejected");

            return shouldUpdateService
              ? {
                  ...item,
                  approval: {
                    ...item.approval,
                    status: target.nextStatus,
                    responded_at: nowIso,
                    synthetic: false,
                  },
                }
              : item;
          });

          const nextBooking =
            target.approvalType === "venue"
              ? {
                  ...order.booking,
                  status: target.nextStatus,
                }
              : order.booking;

          return decorateOrder(
            {
              ...order,
              booking: nextBooking,
              roomApproval: nextRoomApproval,
              services: nextServices,
            },
            venue?.id || null,
            provider?.id || null,
          );
        }),
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("partner-reservations-changed"));
      }

      await notifyBookingDecision({
        bookingId: target.bookingId,
        approvalType: target.approvalType,
        serviceId: target.serviceId,
        venueId: target.venueId,
        status: target.nextStatus,
      });
    } catch (error) {
      console.warn("reservation decision warning:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error,
      });
      setErrorMsg("Nepavyko išsaugoti rezervacijos sprendimo.");
    } finally {
      setProcessingKey("");
    }
  }

  const grouped = useMemo(() => {
    const processed = orders.filter(
      (order) =>
        !order.pendingForViewer &&
        (order.summaryStatus === "confirmed" ||
          order.summaryStatus === "rejected"),
    );

    return {
      pending: orders.filter((order) => order.pendingForViewer),
      processed,
      confirmed: processed.filter(
        (order) => order.summaryStatus === "confirmed",
      ),
      rejected: processed.filter((order) => order.summaryStatus === "rejected"),
    };
  }, [orders]);

  const filteredPendingOrders = useMemo(
    () =>
      grouped.pending.filter((order) =>
        orderMatchesSearch(order, reservationSearch),
      ),
    [grouped.pending, reservationSearch],
  );

  const filteredProcessedOrders = useMemo(() => {
    const source =
      processedTab === "rejected" ? grouped.rejected : grouped.confirmed;

    return source.filter((order) => {
      if (!orderMatchesSearch(order, reservationSearch)) {
        return false;
      }

      const eventDate = order.booking?.event_date || "";

      if (processedDateFrom && eventDate < processedDateFrom) {
        return false;
      }

      if (processedDateTo && eventDate > processedDateTo) {
        return false;
      }

      return true;
    });
  }, [
    grouped.confirmed,
    grouped.rejected,
    processedDateFrom,
    processedDateTo,
    processedTab,
    reservationSearch,
  ]);

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) || null,
    [activeOrderId, orders],
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
        <div className="mb-[28px] flex flex-col gap-[16px] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Rezervacijos
            </p>
            <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
              Klientu užsakymai
            </h1>
            <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
              Vienoje vietoje matysite kambario rezervacija ir visas su ja
              susietas papildomas paslaugas.
            </p>
            {venue && (
              <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                Erdve: <span className="font-semibold">{venue.name}</span>
              </p>
            )}
            {provider && (
              <p className="mt-[4px] ui-font text-[14px] text-slate-500">
                Paslaugos:{" "}
                <span className="font-semibold">{provider.name}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push("/partner")}
            className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Grįžti į paskyros valdymą
          </button>
        </div>

        {errorMsg && (
          <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
            <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
          </div>
        )}

        <div className="mb-[20px] max-w-[420px]">
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

        <section className="space-y-[24px]">
          <div>
            <div className="mb-[14px] flex items-center justify-between">
              <h2 className="ui-font text-[24px] font-semibold text-slate-900">
                Laukiancios užklausos
              </h2>
              <span className="ui-font text-[14px] text-slate-500">
                Is viso: {filteredPendingOrders.length}
              </span>
            </div>

            {filteredPendingOrders.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[28px] text-center">
                <p className="ui-font text-[15px] text-slate-600">
                  Šiuo metu nėra laukiančių užsakymų.
                </p>
              </div>
            ) : (
              <div className="space-y-[16px]">
                {filteredPendingOrders.map((order) => {
                  const booking = order.booking || {};
                  const room = booking.room || {};
                  const pendingServiceCount = order.services.filter(
                    (item) =>
                      item.canManage && item.approval.status === "pending",
                  ).length;
                  const pendingRoom =
                    order.viewerCanManageRoom &&
                    order.roomApproval.status === "pending";

                  return (
                    <article
                      key={order.id}
                      className="rounded-[28px] bg-white p-[24px] shadow-sm"
                    >
                      <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-[14px]">
                          <div className="flex flex-wrap items-center gap-[10px]">
                            <h3 className="ui-font text-[22px] font-semibold text-slate-900">
                              {room.name || "Kambarys"}
                            </h3>
                            <span
                              className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getStatusClassName(
                                order.summaryStatus,
                              )}`}
                            >
                              {getStatusLabel(order.summaryStatus)}
                            </span>
                          </div>

                          <p className="ui-font text-[12px] font-semibold uppercase tracking-[0.08em] text-primary">
                            {booking.reservation_code ||
                              "Rezervacijos Nr. nepaskirtas"}
                          </p>

                          <div className="grid gap-[10px] md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-[18px] bg-slate-50 p-[12px]">
                              <p className="ui-font text-[12px] text-slate-500">
                                Data
                              </p>
                              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                                {booking.event_date || "-"}
                              </p>
                            </div>

                            <div className="rounded-[18px] bg-slate-50 p-[12px]">
                              <p className="ui-font text-[12px] text-slate-500">
                                Laikas
                              </p>
                              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                                {formatTimeRange(
                                  booking.start_time,
                                  booking.end_time,
                                )}
                              </p>
                            </div>

                            <div className="rounded-[18px] bg-slate-50 p-[12px]">
                              <p className="ui-font text-[12px] text-slate-500">
                                Klientas
                              </p>
                              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                                {booking.guest_name || "-"}
                              </p>
                            </div>

                            <div className="rounded-[18px] bg-slate-50 p-[12px]">
                              <p className="ui-font text-[12px] text-slate-500">
                                Bendra suma
                              </p>
                              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                                {formatPrice(
                                  booking.total_amount ?? booking.total_price,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-[220px]">
                          <div className="rounded-[20px] bg-slate-50 p-[14px]">
                            <p className="ui-font text-[13px] text-slate-500">
                              Jusu laukiantys veiksmai
                            </p>
                            <p className="mt-[6px] ui-font text-[15px] font-semibold text-slate-900">
                              {(pendingRoom ? 1 : 0) + pendingServiceCount}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveOrderId(order.id)}
                            className="ui-font mt-[12px] inline-flex h-[48px] w-full items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                          >
                            Peržiūrėti rezervacija
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-[14px] flex flex-col gap-[14px]">
              <div className="flex items-center justify-between">
                <h2 className="ui-font text-[24px] font-semibold text-slate-900">
                  Apdoroti užsakymai
                </h2>
                <span className="ui-font text-[14px] text-slate-500">
                  Is viso: {filteredProcessedOrders.length}
                </span>
              </div>

              <div className="flex flex-col gap-[12px] rounded-[24px] bg-white p-[14px] shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap gap-[8px]">
                  {[
                    {
                      key: "confirmed",
                      label: "Patvirtinti",
                      count: grouped.confirmed.length,
                    },
                    {
                      key: "rejected",
                      label: "Atmesti",
                      count: grouped.rejected.length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setProcessedTab(tab.key)}
                      className={`ui-font inline-flex h-[40px] items-center justify-center rounded-[14px] px-[14px] text-[14px] font-semibold transition ${
                        processedTab === tab.key
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="grid gap-[10px] sm:grid-cols-[1fr_1fr_auto]">
                  <label className="ui-font text-[12px] font-semibold text-slate-500">
                    Nuo
                    <input
                      type="date"
                      value={processedDateFrom}
                      onChange={(event) =>
                        setProcessedDateFrom(event.target.value)
                      }
                      className="mt-[6px] h-[40px] w-full rounded-[14px] border border-slate-200 bg-white px-[12px] text-[14px] text-slate-700 outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="ui-font text-[12px] font-semibold text-slate-500">
                    Iki
                    <input
                      type="date"
                      value={processedDateTo}
                      onChange={(event) =>
                        setProcessedDateTo(event.target.value)
                      }
                      className="mt-[6px] h-[40px] w-full rounded-[14px] border border-slate-200 bg-white px-[12px] text-[14px] text-slate-700 outline-none transition focus:border-primary"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setProcessedDateFrom("");
                      setProcessedDateTo("");
                    }}
                    className="ui-font h-[40px] self-end rounded-[14px] border border-slate-200 bg-white px-[14px] text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Valyti
                  </button>
                </div>
              </div>
            </div>

            {filteredProcessedOrders.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[28px] text-center">
                <p className="ui-font text-[15px] text-slate-600">
                  Nurodytomis dienomis užsakymų nėra..
                </p>
              </div>
            ) : (
              <div className="space-y-[14px]">
                {filteredProcessedOrders.map((order) => {
                  const booking = order.booking || {};
                  const room = booking.room || {};

                  return (
                    <article
                      key={order.id}
                      className="rounded-[24px] bg-white p-[20px] shadow-sm"
                    >
                      <div className="flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-[10px]">
                            <h3 className="ui-font text-[18px] font-semibold text-slate-900">
                              {room.name || "Kambarys"}
                            </h3>
                            <span
                              className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getStatusClassName(
                                order.summaryStatus,
                              )}`}
                            >
                              {getStatusLabel(order.summaryStatus)}
                            </span>
                          </div>

                          <p className="mt-[6px] ui-font text-[12px] font-semibold uppercase tracking-[0.08em] text-primary">
                            {booking.reservation_code ||
                              "Rezervacijos Nr. nepaskirtas"}
                          </p>

                          <p className="mt-[6px] ui-font text-[14px] text-slate-600">
                            {booking.event_date || "-"} •{" "}
                            {formatTimeRange(
                              booking.start_time,
                              booking.end_time,
                            )}
                          </p>

                          <p className="mt-[4px] ui-font text-[13px] text-slate-500">
                            {booking.guest_name || "-"} •{" "}
                            {formatPrice(
                              booking.total_amount ?? booking.total_price,
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveOrderId(order.id)}
                          className="ui-font inline-flex h-[44px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Peržiūrėti rezervacija
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <PartnerReservationDetailsModal
        open={Boolean(activeOrder)}
        order={activeOrder}
        venueId={venue?.id || null}
        providerId={provider?.id || null}
        processingKey={processingKey}
        onClose={() => setActiveOrderId("")}
        onDecision={handleDecision}
      />
    </>
  );
}
