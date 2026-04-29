"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { KeyRound, Pencil, LogOut, CircleUser, CalendarCheck } from "lucide-react";

export default function AuthMenu({ onCloseMobileMenu }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [pendingServiceRequests, setPendingServiceRequests] = useState(0);
  const [hasServiceProvider, setHasServiceProvider] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

  const loadPendingServiceRequests = useCallback(async (userId) => {
    try {
      const { data: providerRow, error: providerError } = await supabase
        .from("service_providers")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle();

      if (providerError || !providerRow?.id) {
        setHasServiceProvider(false);
        setPendingServiceRequests(0);
        return;
      }

      setHasServiceProvider(true);

      const { count, error: countError } = await supabase
        .from("booking_approvals")
        .select("id", { count: "exact", head: true })
        .eq("approval_type", "service")
        .eq("provider_id", providerRow.id)
        .eq("status", "pending");

      if (countError) {
        setPendingServiceRequests(0);
        return;
      }

      setPendingServiceRequests(count || 0);
    } catch (error) {
      console.error("pending service requests count error:", error);
      setPendingServiceRequests(0);
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
          setHasServiceProvider(false);
          setPendingServiceRequests(0);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      loadPendingServiceRequests(user.id);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadPendingServiceRequests, user]);

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
  const hasPendingServiceRequests = pendingServiceRequests > 0;
  const pendingServiceLabel =
    pendingServiceRequests > 99 ? "99+" : String(pendingServiceRequests);

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
          {hasPendingServiceRequests && (
            <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
              {pendingServiceLabel}
            </span>
          )}
        </Link>

        {user && hasServiceProvider && (
          <Link
            href="/partner/paslaugu-uzklausos"
            onClick={handleLinkClick}
            aria-label="Paslaugų rezervacijos"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <CalendarCheck size={18} />
            {hasPendingServiceRequests && (
              <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
                {pendingServiceLabel}
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
          {hasPendingServiceRequests && (
            <span className="ui-font absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-primary">
              {pendingServiceLabel}
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
                  className="ui-font w-full font-bold py-2 text-left text-sm flex items-center gap-2 hover:text-primary"
                >
                  <CircleUser size={18} />
                  Mano paskyra
                </Link>
                <Link
                  href="/partner/paslaugu-uzklausos"
                  onClick={handleLinkClick}
                  className={`ui-font ${
                    hasServiceProvider ? "flex" : "hidden"
                  } w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm font-bold ${
                    hasPendingServiceRequests
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "hover:text-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CalendarCheck size={18} />
                    Rezervacijos
                  </span>
                  {hasPendingServiceRequests && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {pendingServiceLabel}
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
