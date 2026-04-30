"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { buildRoomsWithImages } from "../lib/roomImageUtils";
import RoomCard from "../components/RoomCard";
import Loader from "../components/Loader";

function canCancelBooking(booking) {
  if (!booking.event_date || !booking.start_time) return false;
  if (booking.status === "cancelled" || booking.status === "rejected") {
    return false;
  }

  const [h, m] = booking.start_time.split(":").map(Number);
  const eventDate = new Date(booking.event_date);
  eventDate.setHours(h || 0, m || 0, 0, 0);
  const diffMs = eventDate.getTime() - Date.now();
  const hours = diffMs / (1000 * 60 * 60);
  return hours >= 48;
}

function getBookingStartDate(booking) {
  if (!booking?.event_date) return null;

  const [h, m] = String(booking.start_time || "00:00")
    .split(":")
    .map(Number);
  const date = new Date(booking.event_date);
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

function isUpcomingBooking(booking) {
  const startDate = getBookingStartDate(booking);
  if (!startDate) return true;
  return startDate.getTime() >= Date.now();
}

function isInactiveBookingStatus(status) {
  return status === "cancelled" || status === "rejected";
}

function getBookingStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Laukiama patvirtinimo";
    case "confirmed":
      return "Patvirtinta";
    case "rejected":
      return "Atmesta";
    case "cancelled":
      return "Atšaukta";
    default:
      return status || "Nežinoma";
  }
}

function getBookingStatusClassName(status) {
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

function getReservationStatusSignature(bookings) {
  return (bookings || [])
    .flatMap((booking) => {
      const items = [];

      if (booking.status && booking.status !== "pending") {
        items.push({
          key: `booking:${booking.id}`,
          status: booking.status,
        });
      }

      (booking.booking_approvals || []).forEach((approval) => {
        if (approval.status && approval.status !== "pending") {
          items.push({
            key: `approval:${booking.id}:${approval.service_id || approval.id}`,
            status: approval.status,
          });
        }
      });

      return items;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function getSeenReservationStatuses(userId) {
  if (typeof window === "undefined" || !userId) return {};

  try {
    return JSON.parse(
      localStorage.getItem(`seen_reservation_statuses:${userId}`) || "{}",
    );
  } catch {
    return {};
  }
}

function saveSeenReservationStatusesForBooking(userId, booking) {
  if (typeof window === "undefined" || !userId) return;

  const currentSeen = getSeenReservationStatuses(userId);
  const nextSeen = getReservationStatusSignature([booking]).reduce(
    (map, item) => ({
      ...map,
      [item.key]: item.status,
    }),
    currentSeen,
  );

  localStorage.setItem(
    `seen_reservation_statuses:${userId}`,
    JSON.stringify(nextSeen),
  );

  window.dispatchEvent(
    new CustomEvent("reservation-statuses-seen", {
      detail: { userId },
    }),
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

function formatTimeRange(startTime, endTime) {
  const start = String(startTime || "").slice(0, 5);
  const end = String(endTime || "").slice(0, 5);
  return end ? `${start} - ${end}` : start || "-";
}

function formatPrice(value) {
  if (value == null) return "-";
  return `${Number(value).toFixed(2)} EUR`;
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

function buildBookingDetails(booking) {
  const approvals = booking?.booking_approvals || [];
  const roomApproval = approvals
    .filter((approval) => approval.approval_type === "venue")
    .reduce(
      (current, approval) => pickBestApproval(current, approval),
      null,
    ) || {
    id: `synthetic-venue-${booking.id}`,
    status: booking.status || "pending",
    approval_type: "venue",
  };

  const approvalsByService = approvals
    .filter((approval) => approval.approval_type === "service")
    .reduce((map, approval) => {
      const current = map.get(approval.service_id);
      map.set(approval.service_id, pickBestApproval(current, approval));
      return map;
    }, new Map());

  return {
    roomApproval,
    serviceItems: (booking?.booking_services || []).map((item) => ({
      ...item,
      approval: approvalsByService.get(item.service_id) || {
        id: `synthetic-service-${booking.id}-${item.service_id}`,
        status: "pending",
        approval_type: "service",
        service_id: item.service_id,
      },
    })),
  };
}

function getBookingSummaryStatus(booking) {
  if (!booking) return "pending";
  if (booking.status === "cancelled") return "cancelled";

  const { roomApproval, serviceItems } = buildBookingDetails(booking);
  const approvalStatuses = [
    roomApproval?.status,
    ...serviceItems.map((item) => item.approval?.status),
  ].filter(Boolean);

  if (booking.status === "rejected" || approvalStatuses.includes("rejected")) {
    return "rejected";
  }

  if (
    approvalStatuses.length > 0 &&
    approvalStatuses.every((status) => status === "confirmed")
  ) {
    return "confirmed";
  }

  return "pending";
}

function ClientReservationDetailsModal({ booking, onClose }) {
  if (!booking) return null;

  const room = booking.room || {};
  const venue = room.venue || {};
  const { roomApproval, serviceItems } = buildBookingDetails(booking);
  const summaryStatus = getBookingSummaryStatus(booking);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/45 px-[16px] py-[28px]">
      <section className="w-full max-w-[980px] rounded-[28px] bg-white p-[22px] shadow-xl">
        <div className="mb-[18px] flex items-start justify-between gap-[16px]">
          <div>
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Rezervacijos detales
            </p>
            <h2 className="mt-[6px] ui-font text-[26px] font-semibold text-slate-900">
              {room.name || "Kambarys"}
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              {booking.event_date || "-"}{" "}
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
          <DetailCell label="Data" value={booking.event_date} />
          <DetailCell
            label="Laikas"
            value={formatTimeRange(booking.start_time, booking.end_time)}
          />
          <DetailCell label="Vaikai" value={booking.num_children ?? 0} />
          <DetailCell label="Suauge" value={booking.num_adults ?? 0} />
          <DetailCell label="Vieta" value={venue.name || room.city} />
          <DetailCell
            label="Adresas"
            value={
              [venue.address, venue.city].filter(Boolean).join(", ") ||
              room.city
            }
          />
          <DetailCell
            label="Rezervacijos suma"
            value={formatPrice(booking.total_amount ?? booking.total_price)}
          />
          <DetailCell
            label="Bendras statusas"
            value={getBookingStatusLabel(summaryStatus)}
          />
        </div>

        <div className="mt-[22px] space-y-[14px]">
          <article className="rounded-[22px] border border-slate-200 bg-white p-[16px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <h3 className="ui-font text-[18px] font-semibold text-slate-900">
                {room.name || "Kambario rezervacija"}
              </h3>
              <span
                className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getBookingStatusClassName(
                  roomApproval.status,
                )}`}
              >
                {getBookingStatusLabel(roomApproval.status)}
              </span>
            </div>
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Zaidimu kambario rezervacija
            </p>
          </article>

          {serviceItems.map((item) => {
            const service = item.service || {};
            const providerName =
              service.provider?.name ||
              (service.room_id ? venue.name || "Si vieta" : "Partneris");

            return (
              <article
                key={`${booking.id}:${item.service_id}`}
                className="rounded-[22px] border border-slate-200 bg-white p-[16px]"
              >
                <div className="flex flex-wrap items-center gap-[8px]">
                  <h3 className="ui-font text-[18px] font-semibold text-slate-900">
                    {service.name || "Paslauga"}
                  </h3>
                  <span
                    className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getBookingStatusClassName(
                      item.approval.status,
                    )}`}
                  >
                    {getBookingStatusLabel(item.approval.status)}
                  </span>
                </div>
                <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                  {getServiceTypeLabel(service.service_type)} - {providerName}
                </p>
                <div className="mt-[12px] grid gap-[10px] md:grid-cols-3">
                  <DetailCell label="Tiekejas" value={providerName} />
                  <DetailCell
                    label="Kaina"
                    value={formatPrice(item.price_per_unit)}
                  />
                  <DetailCell
                    label="Matavimo vnt."
                    value={item.units_of_measure || "unit"}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [reservationTab, setReservationTab] = useState("active");
  const [reservationSearch, setReservationSearch] = useState("");
  const [activeBookingId, setActiveBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const insertPendingFavoriteIfAny = async (userId) => {
    if (typeof window === "undefined") return;

    const pendingId = localStorage.getItem("pending_favorite_room_id");
    if (!pendingId) return;

    const { error } = await supabase.from("favorite_rooms").insert({
      user_id: userId,
      room_id: pendingId,
    });

    if (error) {
      console.error("insert pending favorite error:", error.message);
    } else {
      localStorage.removeItem("pending_favorite_room_id");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
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

      setCurrentUserId(user.id);

      try {
        setLoading(true);

        const { data: userRow, error: userRowError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (userRowError) {
          console.error("user role error:", userRowError.message);
        }

        const role = userRow?.role || "client";

        if (role === "admin") {
          router.replace("/admin");
          return;
        }

        if (role === "venue_owner" || role === "service_provider") {
          router.replace("/partner");
          return;
        }

        await insertPendingFavoriteIfAny(user.id);

        const { data: favorites, error: favoritesError } = await supabase
          .from("favorite_rooms")
          .select("room_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        if (favoritesError) {
          console.error("favorites error:", favoritesError.message);
        }

        const roomIds = (favorites || []).map((f) => f.room_id);

        if (roomIds.length > 0) {
          const { data: roomsData, error: roomsError } = await supabase
            .from("rooms")
            .select(
              "id, venue_id, name, description, price, capacity, city, is_listed",
            )
            .in("id", roomIds)
            .eq("is_listed", true);

          if (roomsError) {
            console.error("rooms error:", roomsError.message);
          } else {
            const roomsWithImages =
              (await buildRoomsWithImages({
                supabase,
                rooms: roomsData || [],
              })) || [];

            if (!isMounted) return;
            setRooms(roomsWithImages);
          }
        } else {
          setRooms([]);
        }

        const { data: bookingsData, error: bookingsError } = await supabase
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
            num_children,
            num_adults,
            total_price,
            total_amount,
            booking_services (
              service_id,
              price_per_unit,
              units_of_measure,
              service:services (
                id,
                name,
                service_type,
                room_id,
                provider:service_providers (
                  name
                )
              )
            ),
            booking_approvals (
              id,
              approval_type,
              service_id,
              status,
              responded_at,
              created_at
            ),
            room:rooms (
              id,
              name,
              city,
              venue:venues (
                name,
                address,
                city
              )
            )
          `,
          )
          .eq("user_id", user.id)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (!isMounted) return;

        if (bookingsError) {
          console.error("bookings error:", bookingsError.message);
        } else {
          setBookings(bookingsData || []);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const groupedBookings = useMemo(() => {
    return bookings.reduce(
      (groups, booking) => {
        const summaryStatus = getBookingSummaryStatus(booking);

        if (!isUpcomingBooking(booking)) {
          groups.history.push(booking);
        } else if (isInactiveBookingStatus(summaryStatus)) {
          groups.inactive.push(booking);
        } else {
          groups.active.push(booking);
        }

        return groups;
      },
      {
        active: [],
        inactive: [],
        history: [],
      },
    );
  }, [bookings]);

  const shownBookings =
    groupedBookings[reservationTab] || groupedBookings.active;
  const filteredShownBookings = useMemo(
    () =>
      shownBookings.filter((booking) =>
        bookingMatchesSearch(booking, reservationSearch),
      ),
    [reservationSearch, shownBookings],
  );

  const reservationTabs = [
    {
      key: "active",
      label: "Aktyvios",
      count: groupedBookings.active.length,
      emptyText: "Siuo metu neturite aktyviu rezervaciju.",
    },
    {
      key: "inactive",
      label: "Atmestos",
      count: groupedBookings.inactive.length,
      emptyText: "Siuo metu neturite atmestu ar atsauktu rezervaciju.",
    },
    {
      key: "history",
      label: "Istorija",
      count: groupedBookings.history.length,
      emptyText: "Rezervaciju istorija tuscia.",
    },
  ];

  const activeReservationTab =
    reservationTabs.find((tab) => tab.key === reservationTab) ||
    reservationTabs[0];

  const activeBooking = useMemo(
    () => bookings.find((booking) => booking.id === activeBookingId) || null,
    [activeBookingId, bookings],
  );

  function handleOpenBookingDetails(booking) {
    setActiveBookingId(booking.id);

    if (currentUserId && isUpcomingBooking(booking)) {
      saveSeenReservationStatusesForBooking(currentUserId, booking);
    }
  }

  const handleFavoriteChange = (roomId, isFavorite) => {
    if (!isFavorite) {
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    if (!canCancelBooking(booking)) {
      alert(
        "Šios rezervacijos atšaukti nebegalima, nes liko mažiau nei 48 valandos iki šventės pradžios.",
      );
      return;
    }

    const ok = confirm("Ar tikrai norite atšaukti šią rezervaciją?");
    if (!ok) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      console.error("cancel booking error:", error.message);
      alert("Nepavyko atšaukti rezervacijos. Bandykite dar kartą.");
      return;
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b)),
    );
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 ui-font">
          Mano paskyra
        </h1>
        <p className="text-sm text-slate-600">
          Čia galite matyti pamėgtus kambarius ir valdyti savo rezervacijas.
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold ui-font">Pamėgti kambariai</h2>
          <span className="text-sm text-slate-500">
            Iš viso: {rooms.length}
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-base font-medium text-slate-800 ui-font">
              Neturite pamėgtų kambarių
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Naršykite kambarius ir spauskite ant širdelės, kad juos
              išsaugotumėte.
            </p>

            <a
              href="/paieska"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
            >
              Peržiūrėti kambarius
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                initialIsFavorite={true}
                onFavoriteChange={handleFavoriteChange}
              />
            ))}
          </div>
        )}
      </section>

      <section id="rezervacijos" className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold ui-font">Mano rezervacijos</h2>
          <span className="text-sm text-slate-500">
            Iš viso: {bookings.length}
          </span>
          <div className="inline-flex flex-wrap gap-1 rounded-[20px] bg-slate-100 p-1">
            {reservationTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReservationTab(tab.key)}
                className={`ui-font rounded-[16px] px-4 py-2 text-sm font-semibold transition ${
                  activeReservationTab.key === tab.key
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 hover:text-primary"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

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

        {filteredShownBookings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-600 ui-font">
              {reservationSearch
                ? "Pagal nurodyta paieska rezervaciju nerasta."
                : activeReservationTab.emptyText}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShownBookings.map((b) => {
              const summaryStatus = getBookingSummaryStatus(b);
              const canCancel = canCancelBooking({
                ...b,
                status: summaryStatus,
              });
              const eventDate = b.event_date;
              const startTime = b.start_time?.slice(0, 5) || "";
              const endTime = b.end_time?.slice(0, 5) || "";
              const room = b.room || {};
              const venue = room.venue || {};

              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="ui-font font-semibold text-slate-800">
                        {room.name || "Kambarys"}
                      </p>
                      <span
                        className={`ui-font inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getBookingStatusClassName(
                          summaryStatus,
                        )}`}
                      >
                        {getBookingStatusLabel(summaryStatus)}
                      </span>
                    </div>

                    <p className="ui-font text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                      {b.reservation_code || "Rezervacijos Nr. nepaskirtas"}
                    </p>

                    <p className="ui-font text-xs text-slate-600">
                      {eventDate} {startTime}
                      {endTime && `–${endTime}`}
                    </p>

                    <p className="ui-font text-xs text-slate-500">
                      {venue.name && <span>{venue.name}</span>}
                      {venue.address && (
                        <span>
                          {venue.name ? " • " : ""}
                          {venue.address}
                        </span>
                      )}
                      {venue.city && (
                        <span>
                          {venue.name || venue.address ? ", " : ""}
                          {venue.city}
                        </span>
                      )}
                    </p>

                    {(b.num_children || b.num_adults) && (
                      <p className="ui-font text-[11px] text-slate-500">
                        Vaikai: {b.num_children || 0} • Suaugę:{" "}
                        {b.num_adults || 0}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2 md:mt-0 md:flex-col md:items-end">
                    <button
                      type="button"
                      onClick={() => handleOpenBookingDetails(b)}
                      className="ui-font inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-dark"
                    >
                      Perziureti rezervacija
                    </button>

                    {summaryStatus !== "cancelled" &&
                      summaryStatus !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={!canCancel}
                          className="ui-font inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium transition
                          disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300
                          border-red-300 text-red-600 hover:border-red-500 hover:text-red-700"
                        >
                          Atšaukti rezervaciją
                        </button>
                      )}

                    {!canCancel &&
                      summaryStatus !== "cancelled" &&
                      summaryStatus !== "rejected" && (
                        <span className="ui-font text-[10px] text-slate-400">
                          Atšaukimas galimas tik likus ≥ 48 val.
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ClientReservationDetailsModal
        booking={activeBooking}
        onClose={() => setActiveBookingId("")}
      />
    </main>
  );
}
