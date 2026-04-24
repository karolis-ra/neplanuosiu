"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Loader from "../../components/Loader";

function getStatusLabel(status) {
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
  return `${Number(value).toFixed(2)} €`;
}

async function recalculateBookingStatus(bookingId) {
  const { data: approvalRows, error: approvalsError } = await supabase
    .from("booking_approvals")
    .select("status")
    .eq("booking_id", bookingId);

  if (approvalsError) {
    throw approvalsError;
  }

  const statuses = (approvalRows || []).map((item) => item.status);

  let nextBookingStatus = "pending";

  if (statuses.some((status) => status === "rejected")) {
    nextBookingStatus = "rejected";
  } else if (
    statuses.length > 0 &&
    statuses.every((status) => status === "confirmed")
  ) {
    nextBookingStatus = "confirmed";
  }

  const { error: bookingUpdateError } = await supabase
    .from("bookings")
    .update({ status: nextBookingStatus })
    .eq("id", bookingId);

  if (bookingUpdateError) {
    throw bookingUpdateError;
  }

  return nextBookingStatus;
}

export default function PartnerReservationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [venue, setVenue] = useState(null);
  const [approvalRows, setApprovalRows] = useState([]);
  const [processingId, setProcessingId] = useState("");

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

        const { data: venueRow, error: venueError } = await supabase
          .from("venues")
          .select("id, name, city")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (venueError) {
          throw venueError;
        }

        if (!venueRow) {
          router.replace("/partner");
          return;
        }

        setVenue(venueRow);

        const { data: rows, error: approvalsError } = await supabase
          .from("booking_approvals")
          .select(
            `
            id,
            booking_id,
            approval_type,
            venue_id,
            provider_id,
            service_id,
            status,
            note,
            responded_at,
            created_at,
            booking:bookings (
              id,
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
                city
              )
            )
          `,
          )
          .eq("approval_type", "venue")
          .eq("venue_id", venueRow.id);

        if (!isMounted) return;

        if (approvalsError) {
          throw approvalsError;
        }

        const sortedRows = [...(rows || [])].sort((a, b) => {
          const dateA = a?.booking?.event_date || "";
          const dateB = b?.booking?.event_date || "";
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;

          const timeA = a?.booking?.start_time || "";
          const timeB = b?.booking?.start_time || "";
          if (timeA < timeB) return -1;
          if (timeA > timeB) return 1;

          return 0;
        });

        setApprovalRows(sortedRows);
      } catch (error) {
        console.error("partner reservations load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti rezervacijų užklausų.");
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

  async function updateApprovalStatus(approvalId, bookingId, nextStatus) {
    setProcessingId(approvalId);
    setErrorMsg("");

    try {
      const nowIso = new Date().toISOString();

      const { error: approvalUpdateError } = await supabase
        .from("booking_approvals")
        .update({
          status: nextStatus,
          responded_at: nowIso,
        })
        .eq("id", approvalId);

      if (approvalUpdateError) {
        throw approvalUpdateError;
      }

      const nextBookingStatus = await recalculateBookingStatus(bookingId);

      setApprovalRows((prev) =>
        prev.map((row) =>
          row.id === approvalId
            ? {
                ...row,
                status: nextStatus,
                responded_at: nowIso,
                booking: {
                  ...row.booking,
                  status: nextBookingStatus,
                },
              }
            : row.booking_id === bookingId
              ? {
                  ...row,
                  booking: {
                    ...row.booking,
                    status: nextBookingStatus,
                  },
                }
              : row,
        ),
      );
    } catch (error) {
      console.error("update approval status error:", error);
      setErrorMsg("Nepavyko atnaujinti rezervacijos būsenos.");
    } finally {
      setProcessingId("");
    }
  }

  const grouped = useMemo(
    () => ({
      pending: approvalRows.filter((row) => row.status === "pending"),
      processed: approvalRows.filter((row) => row.status !== "pending"),
    }),
    [approvalRows],
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px] flex flex-col gap-[16px] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Rezervacijų užklausos
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Žaidimų erdvės rezervacijos
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Peržiūrėkite kliento užklausas ir patvirtinkite arba atmeskite
            rezervacijas.
          </p>
          {venue && (
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Erdvė: <span className="font-semibold">{venue.name}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => router.push("/partner/venue")}
          className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Grįžti į erdvės valdymą
        </button>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      <section className="space-y-[24px]">
        <div>
          <div className="mb-[14px] flex items-center justify-between">
            <h2 className="ui-font text-[24px] font-semibold text-slate-900">
              Laukiančios užklausos
            </h2>
            <span className="ui-font text-[14px] text-slate-500">
              Iš viso: {grouped.pending.length}
            </span>
          </div>

          {grouped.pending.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[28px] text-center">
              <p className="ui-font text-[15px] text-slate-600">
                Šiuo metu nėra laukiančių rezervacijų užklausų.
              </p>
            </div>
          ) : (
            <div className="space-y-[16px]">
              {grouped.pending.map((row) => {
                const booking = row.booking || {};
                const room = booking.room || {};
                const isProcessing = processingId === row.id;

                return (
                  <article
                    key={row.id}
                    className="rounded-[28px] bg-white p-[24px] shadow-sm"
                  >
                    <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-[12px]">
                        <div className="flex flex-wrap items-center gap-[10px]">
                          <h3 className="ui-font text-[22px] font-semibold text-slate-900">
                            {room.name || "Kambarys"}
                          </h3>
                          <span
                            className={`ui-font inline-flex items-center rounded-full px-[12px] py-[6px] text-[12px] font-medium ${getStatusClassName(
                              row.status,
                            )}`}
                          >
                            {getStatusLabel(row.status)}
                          </span>
                        </div>

                        <div className="grid gap-[10px] md:grid-cols-2 xl:grid-cols-3">
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
                              {(booking.start_time || "").slice(0, 5)}
                              {booking.end_time
                                ? ` - ${booking.end_time.slice(0, 5)}`
                                : ""}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-slate-50 p-[12px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Pateikta
                            </p>
                            <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                              {(booking.created_at || "").slice(0, 10) || "-"}
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
                              El. paštas
                            </p>
                            <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                              {booking.guest_email || "-"}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-slate-50 p-[12px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Telefonas
                            </p>
                            <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                              {booking.guest_phone || "-"}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-slate-50 p-[12px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Vaikai
                            </p>
                            <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                              {booking.num_children ?? 0}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-slate-50 p-[12px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Suaugę
                            </p>
                            <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                              {booking.num_adults ?? 0}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-slate-50 p-[12px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Suma
                            </p>
                            <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                              {formatPrice(
                                booking.total_amount ?? booking.total_price,
                              )}
                            </p>
                          </div>
                        </div>

                        {booking.note && (
                          <div className="rounded-[20px] bg-slate-50 p-[14px]">
                            <p className="ui-font text-[12px] text-slate-500">
                              Kliento pastaba
                            </p>
                            <p className="mt-[6px] ui-font text-[14px] leading-[22px] text-slate-700">
                              {booking.note}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-[10px]">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            updateApprovalStatus(
                              row.id,
                              booking.id,
                              "confirmed",
                            )
                          }
                          className="ui-font inline-flex h-[48px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isProcessing ? "Saugoma..." : "Patvirtinti"}
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() =>
                            updateApprovalStatus(row.id, booking.id, "rejected")
                          }
                          className="ui-font inline-flex h-[48px] items-center justify-center rounded-[16px] border border-red-200 bg-white px-[16px] text-[14px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                          {isProcessing ? "Saugoma..." : "Atmesti"}
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
          <div className="mb-[14px] flex items-center justify-between">
            <h2 className="ui-font text-[24px] font-semibold text-slate-900">
              Apdorotos rezervacijos
            </h2>
            <span className="ui-font text-[14px] text-slate-500">
              Iš viso: {grouped.processed.length}
            </span>
          </div>

          {grouped.processed.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[28px] text-center">
              <p className="ui-font text-[15px] text-slate-600">
                Dar nėra patvirtintų ar atmestų rezervacijų.
              </p>
            </div>
          ) : (
            <div className="space-y-[14px]">
              {grouped.processed.map((row) => {
                const booking = row.booking || {};
                const room = booking.room || {};

                return (
                  <article
                    key={row.id}
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
                              row.status,
                            )}`}
                          >
                            {getStatusLabel(row.status)}
                          </span>
                        </div>

                        <p className="mt-[6px] ui-font text-[14px] text-slate-600">
                          {booking.event_date || "-"} •{" "}
                          {(booking.start_time || "").slice(0, 5)}
                          {booking.end_time
                            ? ` - ${booking.end_time.slice(0, 5)}`
                            : ""}
                        </p>

                        <p className="mt-[4px] ui-font text-[13px] text-slate-500">
                          {booking.guest_name || "-"} •{" "}
                          {booking.guest_email || "-"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
