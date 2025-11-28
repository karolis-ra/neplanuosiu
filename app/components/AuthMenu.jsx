"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";

export default function AuthMenu() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // uždaryti dropdown paspaudus šalia
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
  }

  const displayName =
    user?.user_metadata?.full_name || user?.email || "Vartotojas";

  return (
    <div className="relative" ref={menuRef}>
      {/* Ikona */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
        aria-label="Vartotojo meniu"
      >
        {/* paprasta user ikona (SVG) */}
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
      </button>

      {/* Dropdown */}
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
                onClick={() => setOpen(false)}
                className="ui-font block rounded-xl px-3 py-2 text-sm hover:bg-slate-100"
              >
                Mano paskyra
              </Link>
              <button
                onClick={handleLogout}
                className="ui-font w-full rounded-xl bg-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-200"
              >
                Atsijungti
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Link
                href="/prisijungti"
                onClick={() => setOpen(false)}
                className="ui-font block rounded-xl px-3 py-2 text-sm hover:bg-slate-100"
              >
                Prisijungti
              </Link>
              <Link
                href="/registracija"
                onClick={() => setOpen(false)}
                className="ui-font block rounded-xl bg-primary px-3 py-2 text-center text-sm text-white hover:bg-dark"
              >
                Registruotis
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
