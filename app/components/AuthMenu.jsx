"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { KeyRound, Pencil, LogOut, CircleUser, CalendarCheck } from "lucide-react";

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

function getSeenReservationStatuses(userId) {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(
      localStorage.getItem(`seen_reservation_statuses:${userId}`) || "{}",
    );
  } catch {
    return {};
  }
}

function getApprovalPriority(approval) {
  const statusScore =
    approval?.status === "confirmed" || approval?.status === "rejected"
      ? 3
      : approval?.status === "cancelled"
        ? 2
        : 1;
  const timestamp = Date.parse(
    approval?.responded_at || approval?.created_at || "1970-01-01T00:00:00Z",
  );

  return [statusScore, Number.isNaN(timestamp) ? 0 : timestamp];
}

function pickBestApproval(current, candidate) {
  if (!current) return candidate;

  const a = getApprovalPriority(current);
  const b = getApprovalPriority(candidate);

  if (b[0] !== a[0]) {
    return b[0] > a[0] ? candidate : current;
  }

  return b[1] >= a[1] ? candidate : current;
}

export default function AuthMenu({ onCloseMobileMenu }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [pendingPartnerReservations, setPendingPartnerReservations] = useState(0);
  const [clientReservationUpdates, setClientReservationUpdates] = useState(0);
  const [hasPartnerReservations, setHasPartnerReservations] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

  const loadPendingPartnerReservations = useCallback(async (userId) => {
    try {
      const [
        { data: providerRow, error: providerError },
        { data: venueRow, error: venueError },
      ] = await Promise.all([
        supabase
          .from("service_providers")
          .select("id")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("venues")
          .select("id")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle(),
      ]);

      if (providerError || venueError || (!providerRow?.id && !venueRow?.id)) {
        setHasPartnerReservations(false);
        setPendingPartnerReservations(0);
        return;
      }

      setHasPartnerReservations(true);

      const countPromises = [];

      if (providerRow?.id) {
        countPromises.push(
          supabase
            .from("booking_approvals")
            .select("id", { count: "exact", head: true })
            .eq("approval_type", "service")
            .eq("provider_id", providerRow.id)
            .eq("status", "pending"),
        );
      }

      if (venueRow?.id) {
        countPromises.push(
          (async () => {
            const { data: bookingsData, error: bookingsError } = await supabase
              .from("bookings")
              .select("id, status, room:rooms!inner(venue_id)")
              .eq("room.venue_id", venueRow.id);

            if (bookingsError) {
              return { count: 0, error: bookingsError };
            }

            const bookingIds = (bookingsData || []).map((booking) => booking.id);

            if (!bookingIds.length) {
              return { count: 0, error: null };
            }

            const { data: approvalsData, error: approvalsError } = await supabase
              .from("booking_approvals")
              .select(
                "booking_id, approval_type, venue_id, status, responded_at, created_at",
              )
              .in("booking_id", bookingIds)
              .eq("approval_type", "venue")
              .eq("venue_id", venueRow.id);

            if (approvalsError) {
              return { count: 0, error: approvalsError };
            }

            const approvalsByBooking = (approvalsData || []).reduce(
              (map, approval) => {
                const current = map.get(approval.booking_id);
                map.set(
                  approval.booking_id,
                  pickBestApproval(current, approval),
                );
                return map;
              },
              new Map(),
            );

            const count = (bookingsData || []).filter((booking) => {
              const approval = approvalsByBooking.get(booking.id);
              const status = approval?.status || booking.status;
              return status === "pending";
            }).length;

            return { count, error: null };
          })(),
        );
      }

      const results = await Promise.all(countPromises);
      const total = results.reduce((sum, result) => {
        if (result.error) return sum;
        return sum + (result.count || 0);
      }, 0);

      setPendingPartnerReservations(total);
    } catch (error) {
      console.warn("pending partner reservations count warning:", error);
      setPendingPartnerReservations(0);
    }
  }, []);

  const loadClientReservationUpdates = useCallback(async (userId) => {
    try {
      const { data: userRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (userRow?.role && userRow.role !== "client") {
        setClientReservationUpdates(0);
        return;
      }

      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          status,
          event_date,
          start_time,
          booking_approvals (
            id,
            service_id,
            status
          )
        `,
        )
        .eq("user_id", userId)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        setClientReservationUpdates(0);
        return;
      }

      const seenStatuses = getSeenReservationStatuses(userId);
      const changedCount = getReservationStatusSignature(
        (bookingsData || []).filter(isUpcomingBooking),
      ).filter((item) => seenStatuses[item.key] !== item.status).length;

      setClientReservationUpdates(changedCount);
    } catch (error) {
      console.warn("client reservation updates count warning:", error);
      setClientReservationUpdates(0);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        if (!session?.user) {
          setHasPartnerReservations(false);
          setPendingPartnerReservations(0);
          setClientReservationUpdates(0);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    function refreshCounts() {
      loadPendingPartnerReservations(user.id);
      loadClientReservationUpdates(user.id);
    }

    const timer = setTimeout(refreshCounts, 0);
    window.addEventListener("reservation-statuses-seen", refreshCounts);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("reservation-statuses-seen", refreshCounts);
    };
  }, [loadClientReservationUpdates, loadPendingPartnerReservations, user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
    if (onCloseMobileMenu) onCloseMobileMenu();
    router.push("/");
  }

  function handleLinkClick() {
    setOpen(false);
    if (onCloseMobileMenu) onCloseMobileMenu();
  }

  const displayName =
    user?.user_metadata?.full_name || user?.email || "Vartotojas";
  const hasPendingPartnerReservations = pendingPartnerReservations > 0;
  const notificationCount = hasPendingPartnerReservations
    ? pendingPartnerReservations
    : clientReservationUpdates;
  const hasNotifications = notificationCount > 0;
  const notificationLabel =
    notificationCount > 99 ? "99+" : String(notificationCount);

  const iconSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20.4C6.55 18.53 8.86 17.25 11.5 17.25h1c2.64 0 4.95 1.28 6.5 3.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="relative">
      {/* Mobile: tiesioginiai mygtukai be dropdown */}
      <div className="md:hidden flex items-center gap-2">
        <Link
          href={user ? "/account" : "/prisijungti"}
          onClick={handleLinkClick}
          aria-label="Vartotojo meniu"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          {iconSvg}
          {hasNotifications && (
            <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
              {notificationLabel}
            </span>
          )}
        </Link>

        {user && hasPendingPartnerReservations && (
          <Link
            href="/partner/rezervacijos"
            onClick={handleLinkClick}
            aria-label="Paslaugų rezervacijos"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <CalendarCheck size={18} />
            {hasPendingPartnerReservations && (
              <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
                {notificationLabel}
              </span>
            )}
          </Link>
        )}

        {user && (
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Atsijungti"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Desktop: dropdown */}
      <div className="hidden md:block" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          aria-label="Vartotojo meniu"
        >
          {iconSvg}
          {hasNotifications && (
            <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
              {notificationLabel}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-lg border border-slate-100">
            {user ? (
              <>
                <div className="mb-2 border-b border-slate-100 pb-2">
                  <p className="ui-font text-xs text-slate-500">
                    Prisijungęs vartotojas
                  </p>
                  <p className="ui-font text-sm font-semibold truncate">
                    {displayName}
                  </p>
                </div>
                <Link
                  href="/account"
                  onClick={handleLinkClick}
                  className={`ui-font flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold ${
                    clientReservationUpdates > 0 && !hasPendingPartnerReservations
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "hover:text-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CircleUser size={18} />
                    Mano paskyra
                  </span>
                  {clientReservationUpdates > 0 && !hasPendingPartnerReservations && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {clientReservationUpdates > 99
                        ? "99+"
                        : clientReservationUpdates}
                    </span>
                  )}
                </Link>
                <Link
                  href="/partner/rezervacijos"
                  onClick={handleLinkClick}
                  className={`ui-font ${
                    hasPartnerReservations ? "flex" : "hidden"
                  } w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold ${
                    hasPendingPartnerReservations
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "hover:text-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CalendarCheck size={18} />
                    Rezervacijos
                  </span>
                  {hasPendingPartnerReservations && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {notificationLabel}
                    </span>
                  )}
                </Link>
                <Link
                  href="/account#rezervacijos"
                  onClick={handleLinkClick}
                  className={`ui-font ${
                    !hasPartnerReservations ? "flex" : "hidden"
                  } w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold ${
                    clientReservationUpdates > 0
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "hover:text-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CalendarCheck size={18} />
                    Rezervacijos
                  </span>
                  {clientReservationUpdates > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {clientReservationUpdates > 99
                        ? "99+"
                        : clientReservationUpdates}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="ui-font w-full font-bold  py-2 text-left text-sm flex items-center gap-2 hover:text-primary"
                >
                  <LogOut size={18} />
                  Atsijungti
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/prisijungti"
                  onClick={handleLinkClick}
                  className="flex justify-center gap-2 ui-font block rounded-xl bg-primary px-3 py-2 text-center text-sm text-white hover:bg-dark"
                >
                  <KeyRound size={18} />
                  Prisijungti
                </Link>
                <Link
                  href="/registracija"
                  onClick={handleLinkClick}
                  className="flex justify-center gap-2 ui-font block rounded-xl bg-primary px-3 py-2 text-center text-sm text-white hover:bg-dark"
                >
                  <Pencil size={18} />
                  Registruotis
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
