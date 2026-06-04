"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function BookingActionButtons({
  roomId,
  selectedDate,
  selectedTime,
  baseDurationMinutes,
  extraMinutes,
  totalPrice,
}) {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;
      setUserRole(userRow?.role || "");
    }

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  const params = useMemo(() => {
    const query = new URLSearchParams();
    query.set("roomId", String(roomId));
    query.set("date", selectedDate);
    query.set("time", selectedTime);
    query.set(
      "duration",
      String(Number(baseDurationMinutes || 0) + Number(extraMinutes || 0)),
    );
    query.set("baseDurationMinutes", String(baseDurationMinutes || 0));
    query.set("extraMinutes", String(extraMinutes || 0));
    query.set("roomTotal", String(totalPrice || 0));
    return query.toString();
  }, [
    roomId,
    selectedDate,
    selectedTime,
    baseDurationMinutes,
    extraMinutes,
    totalPrice,
  ]);

  const isPartner =
    userRole === "partner" ||
    userRole === "venue_owner" ||
    userRole === "service_provider";
  const bookingDisabled =
    !roomId || !selectedDate || !selectedTime || isPartner;

  return (
    <div className="space-y-[12px]">
      <button
        type="button"
        disabled={bookingDisabled}
        onClick={() => router.push(`/rezervacija/paslaugos?${params}`)}
        className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Tęsti
      </button>

      {isPartner ? (
        <p className="ui-font text-center text-[13px] leading-[20px] text-slate-500">
          Partnerio paskyra negali teikti rezervacijos užklausos iš kliento
          srauto.
        </p>
      ) : (
        <p className="ui-font text-center text-[13px] leading-[20px] text-slate-500">
          Kitame žingsnyje peržiūrėsite papildomas paslaugas pagal pasirinktą
          rezervacijos laiką.
        </p>
      )}
    </div>
  );
}
