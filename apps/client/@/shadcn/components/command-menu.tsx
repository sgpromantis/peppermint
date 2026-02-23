import { Button } from "@radix-ui/themes";
import {
    AlertCircle,
    CheckCircle2,
    Circle,
    Clock,
    Plus,
    Search,
    Settings,
    SignalHigh,
    SignalLow,
    SignalMedium,
    Timer,
    Trash2,
    User,
    User2,
    UserPlus2,
} from "lucide-react";
import moment from "moment";
import { useRouter } from "next/router";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from "@/shadcn/ui/command";
import { getCookie } from "cookies-next";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { useUser } from "../../../store/session";
import { useTicketActions } from "../hooks/useTicketActions";
import { Ticket } from "../types/tickets";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { user } = useUser();
  const token = getCookie("session") as string;

  // Add route change handler
  useEffect(() => {
    function handleRouteChange() {
      setOpen(false);
    }

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  const { data: ticketsData, refetch } = useQuery(
    "tickets",
    async () => {
      const response = await fetch("/api/v1/tickets/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      return data.tickets;
    },
    {
      enabled: open,
    }
  );

  const { data: usersData } = useQuery(
    "users",
    async () => {
      const response = await fetch("/api/v1/users/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      return data.users;
    },
    {
      enabled: open,
    }
  );

  const {
    updateTicketStatus,
    updateTicketAssignee,
    updateTicketPriority,
    deleteTicket,
  } = useTicketActions(token, refetch);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const priorities = [
    { label: "Hoch", value: "high", icon: SignalHigh },
    { label: "Mittel", value: "medium", icon: SignalMedium },
    { label: "Niedrig", value: "low", icon: SignalLow },
  ];

  // Filter and group tickets
  const filteredAndGroupedTickets = useMemo(() => {
    if (!ticketsData) return null;

    const filtered = ticketsData.filter((ticket: Ticket) => {
      const searchLower = search.toLowerCase();
      return (
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.id.toString().includes(searchLower) ||
        (ticket.type || "").toLowerCase().includes(searchLower) ||
        (ticket.assignedTo?.name || "").toLowerCase().includes(searchLower)
      );
    });

    // Group by status
    const groups = {
      open: filtered.filter((t: Ticket) => !t.isComplete),
      closed: filtered.filter((t: Ticket) => t.isComplete),
    };

    return groups;
  }, [ticketsData, search]);

  const getStatusIcon = (ticket: Ticket) => {
    if (ticket.isComplete) return CheckCircle2;
    switch (ticket.priority.toLowerCase()) {
      case 'high':
        return AlertCircle;
      case 'medium':
        return Clock;
      case 'low':
        return Timer;
      default:
        return Circle;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative text-foreground hover:cursor-pointer whitespace-nowrap flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span>Suchen</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Tickets nach Titel, ID, Beschreibung oder Bearbeiter suchen..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>Keine Tickets gefunden.</CommandEmpty>

          {/* Navigation */}
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => router.push("/issues")}>
              <Circle className="mr-2 h-4 w-4" />
              <span>Alle Tickets</span>
            </CommandItem>
            <CommandItem onSelect={() => router.push("/issues/open")}>
              <Circle className="mr-2 h-4 w-4" />
              <span>Offene Tickets</span>
            </CommandItem>
            <CommandItem onSelect={() => router.push("/issues/closed")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <span>Geschlossene Tickets</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Neues Ticket erstellen</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Ticket-Suche */}
          {filteredAndGroupedTickets && (
            <>
              {/* Offene Tickets */}
              {filteredAndGroupedTickets.open.length > 0 && (
                <CommandGroup heading="Offene Tickets">
                  {filteredAndGroupedTickets.open.map((ticket: Ticket) => (
                    <CommandItem
                      key={ticket.id}
                      onSelect={() => router.push(`/issue/${ticket.id}`)}
                      className="flex flex-col py-2 px-2 text-sm justify-start items-start hover:cursor-pointer"
                    >
                      <span>{ticket.title}</span>
                      <span className="text-xs text-muted-foreground">
                        #{ticket.id} • {ticket.assignedTo?.name || "Nicht zugewiesen"} • {moment(ticket.createdAt).fromNow()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Geschlossene Tickets */}
              {filteredAndGroupedTickets.closed.length > 0 && (
                <CommandGroup heading="Geschlossene Tickets">
                  {filteredAndGroupedTickets.closed.map((ticket: Ticket) => (
                    <CommandItem
                      key={ticket.id}
                      onSelect={() => router.push(`/issue/${ticket.id}`)}
                      className="flex flex-col py-2 px-2 text-sm justify-start items-start hover:cursor-pointer"
                    >
                      <span>{ticket.title}</span>
                      <span className="text-xs text-muted-foreground">
                        #{ticket.id} • {ticket.assignedTo?.name || "Nicht zugewiesen"} • {moment(ticket.createdAt).fromNow()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}

          <CommandSeparator />

          {/* Schnellaktionen für aktuelles Ticket */}
          {router.pathname.includes("/issue/") &&
            router.query.id &&
            ticketsData && (
              <CommandGroup heading="Ticket Aktionen">
                {/* Status wechseln */}
                <CommandItem
                  onSelect={() => {
                    const ticket = ticketsData.find(
                      (t: Ticket) => t.id === router.query.id
                    );
                    if (ticket) {
                      updateTicketStatus(ticket);
                      setOpen(false);
                    }
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Status wechseln</span>
                </CommandItem>

                {/* Priorität setzen */}
                {priorities.map((priority) => (
                  <CommandItem
                    key={priority.value}
                    onSelect={() => {
                      const ticket = ticketsData.find(
                        (t: Ticket) => t.id === router.query.id
                      );
                      if (ticket) {
                        updateTicketPriority(ticket, priority.value);
                        setOpen(false);
                      }
                    }}
                  >
                    <priority.icon className="mr-2 h-4 w-4" />
                    <span>Priorität: {priority.label}</span>
                  </CommandItem>
                ))}

                {/* Zuweisen */}
                {usersData && (
                  <CommandGroup heading="Zuweisen an">
                    {usersData.map((assignUser: any) => (
                      <CommandItem
                        key={assignUser.id}
                        onSelect={() => {
                          if (router.query.id) {
                            updateTicketAssignee(
                              router.query.id as string,
                              assignUser
                            );
                            setOpen(false);
                          }
                        }}
                      >
                        <UserPlus2 className="mr-2 h-4 w-4" />
                        <span>Zuweisen an {assignUser.name}</span>
                      </CommandItem>
                    ))}
                    <CommandItem
                      onSelect={() => {
                        if (router.query.id) {
                          updateTicketAssignee(
                            router.query.id as string,
                            undefined
                          );
                          setOpen(false);
                        }
                      }}
                    >
                      <User2 className="mr-2 h-4 w-4" />
                      <span>Zuweisung entfernen</span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Löschen */}
                {user?.isAdmin && (
                  <CommandItem
                    onSelect={() => {
                      if (router.query.id) {
                        deleteTicket(router.query.id as string);
                        router.push("/issues");
                        setOpen(false);
                      }
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Ticket löschen</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}

          <CommandSeparator />

          {/* Einstellungen */}
          <CommandGroup heading="Einstellungen">
            <CommandItem onSelect={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Einstellungen</span>
            </CommandItem>
            <CommandItem onSelect={() => router.push("/profile")}>
              <User className="mr-2 h-4 w-4" />
              <span>Profil</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
