"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { KeyRound, Pencil, LogOut, CircleUser } from "lucide-react";

export default function AuthMenu({ onCloseMobileMenu }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          {iconSvg}
        </Link>

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
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
          aria-label="Vartotojo meniu"
        >
          {iconSvg}
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
