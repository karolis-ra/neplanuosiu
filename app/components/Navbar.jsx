"use client";

import { useState } from "react";
import Link from "next/link";
import AuthMenu from "./AuthMenu";
export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Pradžia" },
    { href: "/rooms", label: "Žaidimų kambariai" },
    { href: "/services", label: "Paslaugos" },
    { href: "/about", label: "Apie mus" },
  ];

  return (
    <>
      {/* TOP NAVBAR */}
      <nav className="sticky top-0 left-0 right-0 z-40 bg-primary text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          {/* LOGO */}
          <Link href="/" className="heading text-xl font-bold">
            NEPLANAUOSIU
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="ui-font text-sm font-medium hover:text-secondary transition"
              >
                {link.label}
              </Link>
            ))}
            <AuthMenu />
          </div>

          {/* MOBILE HAMBURGER */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden flex flex-col gap-1"
          >
            <span
              className={`h-0.5 w-6 bg-white transition ${
                isOpen ? "rotate-45 translate-y-1.5" : ""
              }`}
            ></span>
            <span
              className={`h-0.5 w-6 bg-white transition ${
                isOpen ? "opacity-0" : ""
              }`}
            ></span>
            <span
              className={`h-0.5 w-6 bg-white transition ${
                isOpen ? "-rotate-45 -translate-y-1.5" : ""
              }`}
            ></span>
          </button>
        </div>
      </nav>

      {/* MOBILE FULLSCREEN MENU */}
      <div
        className={`fixed inset-0 bg-dark text-white flex flex-col items-center justify-center z-30 transition-opacity duration-300
        ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="ui-font text-3xl font-semibold mb-6 hover:text-secondary"
            onClick={() => setIsOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <AuthMenu />
      </div>
    </>
  );
}
