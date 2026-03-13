/* eslint-disable react/no-unescaped-entities */
"use-client";
import {
  Bell,
  ChevronRight,
  Cloud,
  Globe,
  Inbox,
  Lightbulb,
  Lock,
  User,
} from "lucide-react";
import { colors, identity } from "@peppermint/brand";

const navigation = [
  { name: "Funktionen", href: "#features" },
  { name: "Über uns", href: "#mission" },
  { name: "Kontakt", href: "mailto:info@promantis.de" },
];

const posts: { id: number; title: string; description: string; date: string; datetime: string; author: { name: string; role: string; imageUrl: string }; }[] = [];

const stats = [
  { label: "Zufriedene Kunden", value: "50+" },
  { label: "Gelöste Tickets", value: "10k+" },
];

const features = [
  {
    name: "Benachrichtigungen",
    description:
      "Verbinden Sie promantis mit Drittanbieter-Diensten über Webhooks und verschiedene Provider, inklusive E-Mail-Integration.",
    href: "#",
    icon: Bell,
  },
  {
    name: "Postfach-Integration",
    description:
      "Konfigurieren Sie Postfächer mit SMTP/IMAP, um E-Mails als Tickets automatisch zu erfassen und effizient zu verwalten.",
    href: "#",
    icon: Inbox,
  },
  {
    name: "OIDC-Authentifizierung",
    description:
      "Nutzen Sie OIDC zur Authentifizierung und verbinden Sie sich mit Ihrem bestehenden Identity Provider.",
    href: "#",
    icon: Lock,
  },
];

const features2 = [
  {
    name: "Standort",
    description:
      "promantis ist für jede Umgebung konzipiert und bietet alle Kernfunktionen auch ohne Internetverbindung.",
    icon: Globe,
  },
  {
    name: "Datenhoheit",
    description:
      "promantis gewährleistet den Schutz Ihrer Daten – keine Übertragung an externe Server. Alle Daten werden sicher lokal auf Ihrem Server gespeichert.",
    icon: Lock,
  },
  {
    name: "Leichtgewichtig",
    description:
      "promantis ist leichtgewichtig und schnell – ideal für den Betrieb auf einfacher Hardware mit minimalem Ressourcenverbrauch. Perfekt für kosteneffizientes Hosting.",
    icon: Lightbulb,
  },
  {
    name: "Kunde im Fokus",
    description:
      "promantis ist ein kundenorientiertes Produkt – wir hören aktiv zu und verbessern uns kontinuierlich, um die besten Funktionen bereitzustellen.",
    icon: User,
  },
];

export default function Home() {
  return (
    <div className="sm:min-h-screen mx-6 sm:mx-0 bg-white">
      <header className="bg-white mx-auto text-base max-w-xl">
        <nav className="flex justify-between py-8" aria-label="Global">
          <div className="flex justify-between items-center align-middle lg:flex-1">
            <div className="-m-1.5 p-1.5 flex items-center gap-2">
              <img src="/logo.png" alt={identity.name + ' Logo'} height={36} style={{height: 36, width: 'auto'}} draggable={false} />
            </div>
          </div>

          <div className="flex gap-x-12 align-middle">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-sm font-semibold  text-gray-900"
              >
                {item.name}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <div className="relative isolate overflow-hidden bg-white mx-auto max-w-xl">
        <div className="max-w-xl">
          <div className="hidden sm:mb-4 sm:flex sm:flex-col">
            <div className="">
              <span className="inline-flex space-x-6">
                <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-semibold leading-6 text-green-700 ring-1 ring-inset ring-green-500/20">
                  Neuigkeiten
                  <span className="ml-1 inline-flex items-center space-x-2 text-sm font-medium leading-6 ">
                    <span className="text-sm">Version 2.0 ist da! 🚀</span>
                    <ChevronRight
                      className="h-5 w-5 text-gray-500"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </span>
            </div>
          </div>

          <div className="">
            <span className="text-2xl font-bold tracking-tight text-gray-900 ">
              promantis — Modernes IT-Ticketsystem
            </span>
            <div className="mt-4 flex flex-col ">
              <div className="">
                <p className="text-base text-gray-800">
                  Wir bieten eine innovative Helpdesk- und Ticketlösung,
                  die Ihren IT-Support und Ihre Projekte effizient verwaltet.
                  Selbst-gehostet, datenschutzkonform und kostengünstig —
                  damit Ihr Team jederzeit den Überblick behält.
                </p>
              </div>
              <div className="my-6 space-x-4 flex flex-row">
                <a
                  href="mailto:info@promantis.de"
                  className="rounded-md w-full px-3.5 py-2.5 text-sm text-center font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
                  style={{ backgroundColor: colors.primary }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = colors.primaryHover)}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = colors.primary)}
                >
                  Jetzt Kontakt aufnehmen
                </a>
              </div>
            </div>
          </div>
        </div>

        <div>
          <img
            className="h-full w-full rounded-lg border my-4"
            src="/dashboard.jpeg"
            alt="promantis Dashboard Übersicht"
          />
        </div>
      </div>
      <div className="max-w-xl mx-auto mt-4">
        <div className="mx-auto max-w-xl mt-4 lg:max-w-none">
          <dl className="">
            {features.map((feature) => (
              <div key={feature.name} className="relative flex-col flex mt-4">
                <dt className="flex items-center gap-x-3 text-base font-semibold text-gray-900 max-w-[98px] mt-1">
                  <feature.icon
                    className="h-5 w-5 flex-none"
                    style={{ color: colors.primary }}
                    aria-hidden="true"
                  />
                  <span className="text-gray-900 whitespace-nowrap">
                    {feature.name}
                  </span>
                </dt>
                <dd className="flex flex-auto flex-col mt-1 text-sm sm:text-base text-gray-900">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="max-w-xl mx-auto mt-4">
        <dl className="space-y-4 flex flex-col md:flex-row md:space-x-12">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse ">
              <dt className="text-base leading-7 text-gray-600">
                {stat.label}
              </dt>
              <dd className="text-5xl font-semibold tracking-tight text-gray-900">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-white py-4 max-w-xl mx-auto">
        <dl className="mx-auto mt-4 flex flex-col  text-base leading-7 text-gray-300 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:gap-x-16">
          {features2.map((feature) => (
            <div key={feature.name} className="relative flex-col flex mt-4">
              <dt className="flex items-center gap-x-3 text-base font-semibold text-gray-900 max-w-[98px] mt-1">
                <feature.icon
                  className="h-5 w-5 flex-none"
                  style={{ color: colors.primary }}
                  aria-hidden="true"
                />
                <span className="text-gray-900 whitespace-nowrap">
                  {feature.name}
                </span>
              </dt>
              <dd className="flex flex-auto flex-col text-base text-gray-900">
                <p className="flex-auto">{feature.description}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-white mb-4 mx-auto max-w-xl ">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <h2 id="mission" className="text-xl font-bold tracking-tight text-gray-900 ">
            Unsere Mission
          </h2>
          <div className="mt-2 flex flex-col gap-x-8 gap-y-20 lg:flex-row">
            <div className="lg:w-full lg:max-w-2xl lg:flex-auto">
              <p className="text-base text-gray-800">
                promantis verbindet umfangreiche Funktionalität mit
                Wirtschaftlichkeit. Wir bieten ein breites Spektrum an
                Tools und Funktionen, ohne dabei die Kosten in die Höhe
                zu treiben.
              </p>
              <p className="mt-4 max-w-xl text-base  text-gray-700">
                Unser Fokus liegt darauf, Anwender mit einer Plattform zu
                unterstützen, die Qualität und Benutzerfreundlichkeit in den
                Vordergrund stellt — ohne Kompromisse bei der Erschwinglichkeit.
                So erhalten Unternehmen jeder Größe Zugang zu einer
                funktionsreichen Softwarelösung.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white mb-4 mx-auto max-w-xl ">
        <div className="lg:max-w-lg">
          <h2 className="text-lg font-semibold leading-7 ">
            Schnelle Bereitstellung
          </h2>
          <p className="mt-3 text-base">
            promantis wird als Docker-Container bereitgestellt und lässt sich
            einfach skalieren. Alternativ kann das System direkt über PM2
            oder lokal mit Node.js betrieben werden.
          </p>
          <dl className="mt-6 max-w-xl space-y-8 text-base leading-7 lg:max-w-none">
            <div className="relative pl-9">
              <dt className="inline font-semibold">
                <Cloud
                  className="absolute left-1 top-1 h-5 w-5 "
                  aria-hidden="true"
                />
                Docker
              </dt>
              <dd className="">
                Bereitstellung in wenigen Minuten per Docker Compose –
                inklusive Datenbank und automatischer Konfiguration.
              </dd>
            </div>
          </dl>
          <dl className="mt-6 max-w-xl text-base leading-7 lg:max-w-none">
            <div className="relative pl-9">
              <dt className="inline font-semibold ">
                <Cloud
                  className="absolute left-1 top-1 h-5 w-5 "
                  aria-hidden="true"
                />
                On-Premise
              </dt>
              <dd className="">
                Volle Kontrolle über Ihre Daten durch selbst-gehosteten
                Betrieb auf eigener Infrastruktur oder beliebigem VPS.
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white mt-8">
        <div className="mx-auto max-w-xl">
          <div className="">
            <h2 id="features" className="text-xl font-bold tracking-tight text-gray-900 ">
              Referenzen
            </h2>
            <p className="text-base leading-8 text-gray-800">
              Erfahrungsberichte und Reviews zu unserem Ticketsystem.
            </p>
          </div>
          {posts.length > 0 && (
            <div className="mx-auto mt-4 flex flex-col max-w-2xl gap-y-8 border-t border-gray-200 pt-5 sm:pt-8">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="flex max-w-xl flex-col items-start justify-between"
                >
                  <div className="flex items-center gap-x-4 text-xs">
                    <time dateTime={post.datetime} className="text-gray-500">
                      {post.date}
                    </time>
                  </div>
                  <div className="group relative">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">{post.description}</p>
                  </div>
                  <div className="relative mt-4 flex items-center gap-x-4">
                    <div className="text-sm leading-6">
                      <p className="font-semibold text-gray-900">
                        {post.author.name}
                      </p>
                      <p className="text-gray-600">{post.author.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {posts.length === 0 && (
            <div className="mt-4 border-t border-gray-200 pt-5">
              <p className="text-sm text-gray-500">Demnächst verfügbar.</p>
            </div>
          )}
        </div>
      </div>
      <footer className="bg-white" aria-labelledby="footer-heading">
        <div className="mx-auto max-w-xl px-6 pb-8 pt-16 sm:pt-24">
          <div className="mt-16 border-t border-gray-900/10 pt-8 sm:mt-20 lg:mt-24">
            <p className="text-xs leading-5 text-gray-500">
              &copy; 2026 promantis. Alle Rechte vorbehalten.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
