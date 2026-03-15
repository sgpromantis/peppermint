import { identity } from "@promantis/brand";
import {
  Building,
  FileText,
  ListPlus,
  Settings,
  SquareKanban
} from "lucide-react";
import * as React from "react";

import { NavMain } from "@/shadcn/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/shadcn/ui/sidebar";
import useTranslation from "next-translate/useTranslation";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import CreateTicketModal from "../../../components/CreateTicketModal";
import ThemeSettings from "../../../components/ThemeSettings";
import { useUser } from "../../../store/session";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useRouter();

  const { loading, user, fetchUserProfile } = useUser();
  const locale = user ? user.language : "en";

  const [keypressdown, setKeyPressDown] = useState(false);

  const { t, lang } = useTranslation("common");
  const sidebar = useSidebar();

  if (!user) {
    location.push("/auth/login");
  }

  if (location.pathname.includes("/admin") && user.isAdmin === false) {
    location.push("/");
    alert("You do not have the correct perms for that action.");
  }

  if (user && user.external_user) {
    location.push("/portal");
  }

  const isAdminOrManager = user?.isAdmin || user?.isManager;

  const allNavItems = [
    {
      title: "Neues Ticket",
      url: ``,
      icon: ListPlus,
      isActive: location.pathname === "/" ? true : false,
      initial: "c",
    },
    {
      title: t("sl_dashboard"),
      url: `/${locale}/`,
      icon: Building,
      isActive: location.pathname === "/" ? true : false,
      initial: "h",
    },
    {
      title: "Dokumente",
      url: `/${locale}/documents`,
      icon: FileText,
      isActive: location.pathname === "/documents" ? true : false,
      initial: "d",
      internal: true,
    },
    ...(isAdminOrManager
      ? [
          {
            title: "Tickets",
            url: `/${locale}/issues`,
            icon: SquareKanban,
            isActive: location.pathname === "/issues" ? true : false,
            initial: "t",
            items: [
              {
                title: "Offen",
                url: "/issues/open",
                initial: "o",
              },
              {
                title: "Geschlossen",
                url: "/issues/closed",
                initial: "f",
              },
            ],
          },
        ]
      : []),
    ...(user?.isAdmin
      ? [
          {
            title: "Verwaltung",
            url: "/admin",
            icon: Settings,
            isActive: true,
            initial: "a",
          },
        ]
      : []),
  ];

  const data = {
    teams: [
      {
        name: "promantis Helpdesk",
        plan: `version: ${identity.version}`,
      },
    ],
    navMain: allNavItems,
  };

  function handleKeyPress(event: any) {
    const pathname = location.pathname;

    // Check for Ctrl or Meta key to bypass the shortcut handler
    if (event.ctrlKey || event.metaKey) {
      return; // Don't override browser shortcuts
    }

    if (
      document.activeElement!.tagName !== "INPUT" &&
      document.activeElement!.tagName !== "TEXTAREA" &&
      !document.activeElement!.className.includes("ProseMirror") &&
      !pathname.includes("/new")
    ) {
      switch (event.key) {
        case "c":
          setKeyPressDown(true);
          break;
        case "h":
          location.push("/");
          break;
        case "d":
          location.push("/documents");
          break;
        case "t":
          location.push("/issues");
          break;
        case "a":
          location.push("/admin");
          break;
        case "o":
          location.push("/issues/open");
          break;
        case "f":
          location.push("/issues/closed");
          break;
        case "[":
          sidebar.toggleSidebar();
          break;

        default:
          break;
      }
    }
  }

  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress, location]);

  return (
    <Sidebar collapsible="icon" {...props} >
      <SidebarHeader>
        {/* <TeamSwitcher teams={data.teams} /> */}
        <div className="flex items-center gap-2 ">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
            <img src="/logo.png" alt="promantis Logo" className="size-8 object-contain" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-xl">promantis</span>
            <span className="truncate text-xs">
              version: {identity.version}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <CreateTicketModal
          keypress={keypressdown}
          setKeyPressDown={setKeyPressDown}
        />
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="hidden sm:block ">
          <ThemeSettings />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
