import Link from "next/link";
import { MapPin } from "lucide-react";

const footerLinks = [
  {
    title: "Navigacija",
    links: [
      { href: "/", label: "Pradžia" },
      { href: "/paieska", label: "Žaidimų kambariai" },
      { href: "/prisijungti", label: "Prisijungti" },
    ],
  },
  {
    title: "Partneriams",
    links: [
      { href: "/partner/registracija", label: "Tapti partneriu" },
      { href: "/partner", label: "Partnerio paskyra" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Link href="/" className="heading text-xl font-bold text-primary">
            NEPLANUOSIU
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
            Platforma, padedanti greičiau rasti žaidimų kambarį vaikų
            gimtadieniui ir pateikti rezervacijos užklausą internetu.
          </p>
          <div className="mt-5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              Lietuva
            </span>
          </div>
        </div>

        {footerLinks.map((group) => (
          <div key={group.title}>
            <h2 className="ui-font text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {group.title}
            </h2>
            <div className="mt-4 grid gap-3">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-slate-700 transition hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Neplanuosiu. Visos teisės saugomos.</p>
          <p>Vaikų gimtadieniai paprasčiau.</p>
        </div>
      </div>
    </footer>
  );
}
