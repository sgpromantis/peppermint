import { classNames } from "@/shadcn/lib/utils";
import { SidebarProvider } from "@/shadcn/ui/sidebar";
import { Dialog, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  InboxStackIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@radix-ui/themes";
import {
  BarChart3,
  Clock,
  Cloud,
  ContactIcon,
  FileText,
  KeyRound,
  Mail,
  Mailbox,
  MoveLeft,
  RollerCoaster,
  ScrollText,
  UserRound,
  Webhook,
} from "lucide-react";
import useTranslation from "next-translate/useTranslation";
import Link from "next/link";
import { Fragment, useState } from "react";

import { AccountDropdown } from "../components/AccountDropdown";
import ThemeSettings from "../components/ThemeSettings";
import { useUser } from "../store/session";
import Image from "next/image";

export default function AdminLayout({ children }: any) {
  const { t, lang } = useTranslation("peppermint");

  const { loading, user } = useUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (user && !user.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">Sie sind kein Administrator</h1>
      </div>
    );
  }

  const navigation = [
    {
      name: "Zurück",
      href: "/",
      current: null,
      icon: MoveLeft,
    },
    {
      name: t("sl_users"),
      href: "/admin/users/internal",
      current: location.pathname === "/admin/users/internal",
      icon: UserRound,
    },
    {
      name: t("sl_clients"),
      href: "/admin/clients",
      current: location.pathname === "/admin/clients",
      icon: ContactIcon,
    },
    {
      name: "E-Mail-Warteschlangen",
      href: "/admin/email-queues",
      current: location.pathname === "/admin/email-queues",
      icon: Mail,
    },
    {
      name: "Webhooks",
      href: "/admin/webhooks",
      current: location.pathname === "/admin/webhooks",
      icon: Webhook,
    },
    {
      name: "SMTP E-Mail",
      href: "/admin/smtp",
      current: location.pathname === "/admin/smtp",
      icon: Mailbox,
    },
    {
      name: "Authentifizierung",
      href: "/admin/authentication",
      current: location.pathname === "/admin/authentication",
      icon: KeyRound,
    },
    {
      name: "Rollen",
      href: "/admin/roles",
      current: location.pathname === "/admin/roles",
      icon: RollerCoaster,
    },
    {
      name: "Microsoft 365",
      href: "/admin/microsoft-sync",
      current: location.pathname === "/admin/microsoft-sync",
      icon: Cloud,
    },
    {
      name: "Monitoring",
      href: "/admin/monitoring",
      current: location.pathname === "/admin/monitoring",
      icon: BarChart3,
    },
    {
      name: "Protokolle",
      href: "/admin/logs",
      current: location.pathname === "/admin/logs",
      icon: FileText,
    },
    {
      name: "Monatsbericht",
      href: "/admin/reports",
      current: location.pathname === "/admin/reports",
      icon: ScrollText,
    },
    {
      name: "Zeiterfassung",
      href: "/admin/timesheet",
      current: location.pathname === "/admin/timesheet",
      icon: Clock,
    },
  ];

  return (
    return (
      <SidebarProvider>
        <div className="flex h-screen bg-gray-100">
          {/* Sidebar */}
          <Transition.Root show={sidebarOpen} as={Fragment}>
            <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
              {/* ...existing code... */}
            </Dialog>
          </Transition.Root>
          {/* Static sidebar for desktop */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
              <div className="flex flex-col items-center h-24 px-6 justify-center bg-white border-b border-gray-200">
                <Image src="/logo.svg" alt="Logo" width={120} height={60} priority />
                <span className="text-xl font-bold tracking-tight text-gray-900 mt-2">Admin</span>
              </div>
              {/* ...existing code... */}
            </div>
          </div>
          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* ...existing code... */}
            <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
              {/* Logo for dashboard header (visible on all admin pages) */}
              <div className="flex items-center justify-center py-4">
                <Image src="/logo.svg" alt="Logo" width={120} height={60} priority />
              </div>
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
                  leave="transition ease-in-out duration-300 transform"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                    <Transition.Child
                      as={Fragment}
                      enter="ease-in-out duration-300"
                      enterFrom="opacity-0"
                      enterTo="opacity-100"
                      leave="ease-in-out duration-300"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                        <button
                          type="button"
                          className="-m-2.5 p-2.5"
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="sr-only">Close sidebar</span>
                          <XMarkIcon
                            className="h-6 w-6 text-white"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </Transition.Child>
                    {/* Sidebar component, swap this element with another sidebar if you like */}
                    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 pb-4">
                      <div className="flex align-middle flex-row h-14 items-center border-b-[1px]">
                        <Link href="/">
                          <div className="flex items-center gap-2 select-none">
                            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect width="30" height="30" rx="7" fill="#1E3A8A"/>
                              <path fillRule="evenodd" clipRule="evenodd" d="M8 6H18A6 6 0 0 1 18 18H11V26H8V6ZM11 9H18A3 3 0 0 1 18 15H11V9Z" fill="white"/>
                              <rect x="8" y="22.5" width="14" height="2" rx="1" fill="#0891B2"/>
                            </svg>
                            <div className="flex flex-col leading-none">
                              <span className="font-bold text-sm tracking-tight text-foreground">promantis</span>
                              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{color:"#0891B2"}}>Helpdesk</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                      <nav className="flex flex-1 flex-col">
                        <ul
                          role="list"
                          className="flex flex-1 flex-col gap-y-7"
                        >
                          <li>
                            <ul role="list" className="-mx-2 space-y-1">
                              {navigation.map((item: any) => (
                                <li key={item.name}>
                                  <Link
                                    href={item.href}
                                    className={classNames(
                                      item.current
                                        ? "bg-secondary dark:bg-primary"
                                        : " hover:bg-[#F0F3F9] dark:hover:bg-white dark:hover:text-gray-900 ",
                                      "group -mx-2 flex gap-x-3 p-1 rounded-md text-xs font-semibold leading-6"
                                    )}
                                  >
                                    <item.icon
                                      className="h-4 w-4 ml-1 shrink-0 mt-1"
                                      aria-hidden="true"
                                    />
                                    <span className="whitespace-nowrap">
                                      {item.name}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </Dialog>
          </Transition.Root>

          {/* Static sidebar for desktop */}
          <div className="hidden lg:fixed lg:inset-y-0 lg:z-10 lg:flex lg:w-64 2xl:w-72 lg:flex-col border-r">
            {/* Sidebar component, swap this element with another sidebar if you like */}
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-background pb-4">
              <div className="flex align-middle flex-row h-14 items-center border-b px-6">
                <Link href="/">
                  <div className="flex items-center gap-2 select-none">
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="30" height="30" rx="7" fill="#1E3A8A"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M8 6H18A6 6 0 0 1 18 18H11V26H8V6ZM11 9H18A3 3 0 0 1 18 15H11V9Z" fill="white"/>
                      <rect x="8" y="22.5" width="14" height="2" rx="1" fill="#0891B2"/>
                    </svg>
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-sm tracking-tight text-foreground">promantis</span>
                      <span className="text-[10px] font-semibold tracking-widest uppercase" style={{color:"#0891B2"}}>Helpdesk</span>
                    </div>
                  </div>
                </Link>
              </div>
              <nav className="flex flex-1 flex-col px-6">
                <ul role="list" className="flex flex-1 flex-col gap-y-7 w-full">
                  <li>
                    <ul role="list" className="-mx-2 space-y-1 w-full">
                      {navigation.map((item: any) => (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={classNames(
                              item.current
                                ? "bg-secondary dark:bg-primary"
                                : " hover:bg-[#F0F3F9] dark:hover:bg-white dark:hover:text-gray-900 ",
                              "group -mx-2 flex gap-x-3 p-1 rounded-md text-xs font-semibold leading-6"
                            )}
                          >
                            <item.icon
                              className="h-4 w-4 ml-1 shrink-0 mt-1"
                              aria-hidden="true"
                            />
                            <span className="whitespace-nowrap">
                              {item.name}
                            </span>
                            <div className="flex w-full justify-end float-right">
                              <span className="flex h-6 w-6 shrink-0 items-center bg-transparent border-none justify-center text-md font-medium">
                                {item.initial}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
                <ThemeSettings />
              </nav>
            </div>
          </div>

          <div className="lg:pl-64 2xl:pl-72">
            <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-x-4 border-b  bg-background px-4 sm:gap-x-6">
              <button
                type="button"
                className="-m-2.5 p-2.5 text-foreground lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon
                  className="h-6 w-6 text-foreground"
                  aria-hidden="true"
                />
              </button>

              {/* Separator */}
              <div
                className="h-6 w-px bg-gray-400 lg:hidden"
                aria-hidden="true"
              />

              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
                <div className="sm:flex hidden w-full justify-start items-center space-x-6">
                  {user.isAdmin && (
                    <span className="inline-flex items-center rounded-md bg-blue-900/10 px-3 py-2 text-xs font-medium text-blue-900 ring-1 ring-inset ring-blue-900/20">
                      Version 1.8
                    </span>
                  )}
                </div>

                <div className="flex w-full justify-end items-center gap-x-2 lg:gap-x-2 ">
                  <Button
                    variant="outline"
                    className="relative rounded-md p-2 text-gray-400 hover:text-gray-500 hover:cursor-pointer focus:outline-none"
                  >
                    <Link href="/notifications">
                      <InboxStackIcon className="h-4 w-4 text-foreground" />
                      {user.notifcations.filter(
                        (notification) => !notification.read
                      ).length > 0 && (
                        <svg
                          className="h-2.5 w-2.5 absolute bottom-6 left-6 animate-pulse fill-green-500"
                          viewBox="0 0 6 6"
                          aria-hidden="true"
                        >
                          <circle cx={3} cy={3} r={3} />
                        </svg>
                      )}
                    </Link>
                  </Button>

                  {/* Profile dropdown */}
                  <AccountDropdown />
                </div>
              </div>
            </div>

            {!loading && !user.external_user && (
              <main className="bg-background m-4">{children}</main>
            )}
          </div>
        </div>
      </SidebarProvider>
    )
  );
}
