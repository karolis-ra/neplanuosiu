import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Coins,
  MapPin,
  MessageCircle,
  PartyPopper,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

const benefits = [
  {
    title: "Laisvi laikai iš karto",
    description: "Matykite datas ir laikus, kurie tinka jūsų šventei.",
    icon: CalendarCheck,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Aiškios kainos",
    description: "Palyginkite kambarius pagal kainą, miestą ir dydį.",
    icon: Coins,
    color: "bg-amber-50 text-amber-700",
  },
  {
    title: "Patikrintos vietos",
    description: "Vienoje vietoje raskite žaidimų erdves gimtadieniams.",
    icon: ShieldCheck,
    color: "bg-sky-50 text-sky-700",
  },
  {
    title: "Mažiau skambučių",
    description: "Pateikite rezervacijos užklausą be ilgo derinimo.",
    icon: MessageCircle,
    color: "bg-rose-50 text-rose-700",
  },
];

const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

const steps = [
  {
    title: "Pasirinkite laiką",
    description: "Įveskite miestą, datą ir pageidaujamą pradžios laiką.",
    icon: Search,
  },
  {
    title: "Peržiūrėkite variantus",
    description: "Palyginkite laisvus kambarius pagal kainą ir vietą.",
    icon: Sparkles,
  },
  {
    title: "Pateikite užklausą",
    description: "Rezervacijos informacija keliauja tiesiai partneriui.",
    icon: PartyPopper,
  },
];

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="ui-font text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
      )}
      <h2 className="heading mt-2 text-2xl font-bold text-primary md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      )}
    </div>
  );
}

export default function HomeSections() {
  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-18">
        <SectionHeader
          eyebrow="Kodėl patogu"
          title="Gimtadienio planavimas be chaoso"
          description="Svarbiausia informacija matoma iš karto, todėl galite greičiau atsirinkti tinkamą vietą ir judėti prie šventės detalių."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ title, description, icon: Icon, color }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm"
            >
              <div
                className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
              >
                <Icon className="h-6 w-6" strokeWidth={2.1} />
              </div>
              <h3 className="heading text-base font-bold text-slate-950">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-9 flex justify-center">
          <Link
            href="/paieska"
            className="ui-font inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-dark"
          >
            Peržiūrėti žaidimų kambarius
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-18">
          <SectionHeader
            eyebrow="Miestai"
            title="Raskite vietą arčiau namų"
            description="Pradėkite nuo miesto ir greitai pereikite prie laisvų žaidimų kambarių sąrašo."
          />

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cities.map((city) => (
              <Link
                key={city}
                href={`/paieska?miestas=${encodeURIComponent(city)}`}
                className="group flex min-h-[88px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span>
                  <span className="heading block text-lg font-bold text-slate-950">
                    {city}
                  </span>
                  <span className="ui-font mt-1 block text-sm text-slate-500">
                    Žaidimų kambariai
                  </span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary transition group-hover:bg-primary group-hover:text-white">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-18">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="ui-font text-sm font-semibold uppercase tracking-[0.16em] text-accent">
              Kaip veikia
            </p>
            <h2 className="heading mt-2 text-2xl font-bold text-primary md:text-4xl">
              Nuo idėjos iki rezervacijos per kelis žingsnius
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Neplanuosiu padeda greitai surasti, bei rezervuoti paslaugas ir
              palieka daugiau laiko pačiai šventei.
            </p>
          </div>

          <div className="grid gap-4">
            {steps.map(({ title, description, icon: Icon }, index) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Icon className="h-6 w-6" strokeWidth={2.1} />
                </div>
                <div>
                  <p className="ui-font text-sm font-bold text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="heading mt-1 text-lg font-bold text-slate-950">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-20">
        <div className="grid gap-6 rounded-3xl bg-primary px-6 py-8 text-white shadow-xl md:grid-cols-[1fr_auto] md:items-center md:px-8">
          <div className="flex gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-secondary sm:flex">
              <Store className="h-7 w-7" />
            </div>
            <div>
              <h2 className="heading text-2xl font-bold">
                Turite žaidimų kambarį?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100 md:text-base">
                Prisijunkite prie platformos, valdykite rezervacijas ir
                parodykite savo erdvę šeimoms, kurios jau ieško šventės vietos.
              </p>
            </div>
          </div>

          <Link
            href="/partner/registracija"
            className="ui-font inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-primary transition hover:bg-white"
          >
            Tapti partneriu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
