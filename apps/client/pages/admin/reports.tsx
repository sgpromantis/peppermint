import { getCookie } from "cookies-next";
import moment from "moment";
import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Button } from "@/shadcn/ui/button";
import { useUser } from "../../store/session";
import { useRouter } from "next/router";

/**
 * Extracts plain text from a BlockNote JSON detail field.
 * Falls back to the raw string if it's not valid JSON or not BlockNote format.
 */
function blockNoteToText(detail: string | null | undefined): string {
  if (!detail) return "";
  try {
    const blocks = JSON.parse(detail);
    if (!Array.isArray(blocks)) return detail;

    const extractInline = (content: any[]): string => {
      if (!Array.isArray(content)) return "";
      return content
        .map((item) => {
          if (item.type === "text") return item.text ?? "";
          if (item.type === "link") return extractInline(item.content ?? []);
          return "";
        })
        .join("");
    };

    const extractBlock = (block: any): string => {
      const line = extractInline(block.content ?? []);
      const children = (block.children ?? []).map(extractBlock).join("\n");
      return children ? line + "\n" + children : line;
    };

    return blocks.map(extractBlock).join("\n").trim();
  } catch {
    // Not JSON → might be plain HTML or plain text from old tickets
    return detail.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  }
}

const fetchClients = async () => {
  const res = await fetch(`/api/v1/clients/all`, {
    headers: { Authorization: `Bearer ${getCookie("session")}` },
  });
  return res.json();
};

const fetchReport = async (year: number, month: number, clientId: string) => {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    ...(clientId ? { clientId } : {}),
  });
  const res = await fetch(`/api/v1/report/monthly?${params}`, {
    headers: { Authorization: `Bearer ${getCookie("session")}` },
  });
  return res.json();
};

function formatMinutes(min: number) {
  if (!min) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m > 0 ? m + " Min." : ""}`;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    needs_support: "Offen",
    in_progress: "In Bearbeitung",
    waiting_on_customer: "Wartet auf Kunde",
    waiting_on_third_party: "Wartet auf Dritte",
    resolved: "Gelöst",
  };
  return map[s] ?? s;
}

function priorityLabel(p: string) {
  const map: Record<string, string> = {
    Low: "Niedrig",
    Normal: "Normal",
    High: "Hoch",
  };
  return map[p] ?? p;
}

export default function MonthlyReports() {
  const router = useRouter();
  const { user } = useUser();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [clientId, setClientId] = useState("");
  const [fetchEnabled, setFetchEnabled] = useState(false);

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.push("/");
    }
  }, [user]);

  const { data: clientsData } = useQuery("all-clients", fetchClients);

  const {
    data: reportData,
    isFetching,
    refetch,
  } = useQuery(
    ["report", year, month, clientId],
    () => fetchReport(year, month, clientId),
    { enabled: fetchEnabled, keepPreviousData: true }
  );

  const handleGenerate = () => {
    setFetchEnabled(true);
    refetch();
  };

  const handleDownloadCsv = () => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      ...(clientId ? { clientId } : {}),
    });
    const token = getCookie("session");
    // Use a hidden anchor with auth token in query not possible natively,
    // so fetch and trigger download manually
    fetch(`/api/v1/report/monthly/csv?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Monatsbericht_${year}_${String(month).padStart(2, "0")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handlePrint = () => window.print();

  const monthName = new Date(year, month - 1, 1).toLocaleString("de-DE", {
    month: "long",
  });

  const tickets = reportData?.tickets ?? [];
  const summary = reportData?.clientSummary ?? [];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = [
    { v: 1, l: "Januar" }, { v: 2, l: "Februar" }, { v: 3, l: "März" },
    { v: 4, l: "April" }, { v: 5, l: "Mai" }, { v: 6, l: "Juni" },
    { v: 7, l: "Juli" }, { v: 8, l: "August" }, { v: 9, l: "September" },
    { v: 10, l: "Oktober" }, { v: 11, l: "November" }, { v: 12, l: "Dezember" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ---- Controls (hidden on print) ---- */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold mb-6">Monatsbericht</h1>

        <div className="flex flex-wrap gap-4 items-end mb-6">
          {/* Year */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Jahr</label>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Monat</label>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {months.map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>

          {/* Client filter */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Kunde (optional)</label>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background min-w-[200px]"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Alle Kunden</option>
              {clientsData?.clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <Button onClick={handleGenerate} disabled={isFetching}>
            {isFetching ? "Lädt…" : "Bericht erstellen"}
          </Button>

          {tickets.length > 0 && (
            <>
              <Button variant="outline" onClick={handleDownloadCsv}>
                CSV herunterladen
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                Drucken / PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ---- Report (visible + printable) ---- */}
      {tickets.length > 0 && (
        <div id="report-content">
          {/* Report header */}
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-bold">
              Monatsbericht {monthName} {year}
              {clientId && clientsData?.clients && (
                <span className="font-normal text-muted-foreground ml-2">
                  – {clientsData.clients.find((c: any) => c.id === clientId)?.name}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Erstellt am {moment().format("DD.MM.YYYY HH:mm")} Uhr
            </p>
          </div>

          {/* Summary table */}
          {summary.length > 1 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-2">Zusammenfassung nach Kunde</h3>
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2">Kunde</th>
                    <th className="text-right px-3 py-2">Tickets</th>
                    <th className="text-right px-3 py-2">Zeit gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s: any, i: number) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2 text-right">{s.ticketCount}</td>
                      <td className="px-3 py-2 text-right">{formatMinutes(s.totalMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ticket list */}
          <div className="space-y-6">
            {tickets.map((ticket: any) => (
              <div
                key={ticket.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden print:break-inside-avoid"
              >
                {/* Ticket header */}
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground font-mono mr-2">
                      #{ticket.Number}
                    </span>
                    <span className="font-semibold">{ticket.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {ticket.type}
                    </span>
                    <span
                      className={
                        ticket.priority === "High"
                          ? "bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                          : ticket.priority === "Low"
                          ? "bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full"
                          : "bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                      }
                    >
                      {priorityLabel(ticket.priority)}
                    </span>
                    <span
                      className={
                        ticket.isComplete
                          ? "bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                          : "bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                      }
                    >
                      {ticket.isComplete ? "Geschlossen" : statusLabel(ticket.status)}
                    </span>
                  </div>
                </div>

                {/* Ticket meta */}
                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-xs text-muted-foreground">Erstellt</div>
                    <div>{moment(ticket.createdAt).format("DD.MM.YYYY")}</div>
                  </div>
                  {ticket.isComplete && (
                    <div>
                      <div className="text-xs text-muted-foreground">Geschlossen</div>
                      <div>{moment(ticket.updatedAt).format("DD.MM.YYYY")}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground">Kontakt</div>
                    <div>{ticket.name || "–"}</div>
                    {ticket.email && (
                      <div className="text-xs text-muted-foreground">{ticket.email}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Zugewiesen an</div>
                    <div>{ticket.assignedTo?.name || "–"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Kunde</div>
                    <div>{ticket.client?.name || "–"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Zeit</div>
                    <div>{formatMinutes(ticket.totalMinutes)}</div>
                  </div>
                </div>

                {/* Description */}
                {ticket.detail && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm">
                    <div className="text-xs text-muted-foreground mb-1 font-semibold">Beschreibung</div>
                    <p className="whitespace-pre-wrap text-sm">{blockNoteToText(ticket.detail)}</p>
                  </div>
                )}

                {/* Comments */}
                {ticket.Comment && ticket.Comment.length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                      Kommentare ({ticket.Comment.length})
                    </div>
                    <div className="space-y-3">
                      {ticket.Comment.map((c: any) => (
                        <div
                          key={c.id}
                          className="bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {c.user?.name || "System"}
                            </span>
                            <span>·</span>
                            <span>{moment(c.createdAt).format("DD.MM.YYYY HH:mm")}</span>
                            {c.public && (
                              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                öffentlich
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-sm text-muted-foreground print:block hidden">
            Monatsbericht {monthName} {year} – Seite <span className="print-page-number" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {fetchEnabled && !isFetching && tickets.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Keine Tickets für diesen Zeitraum gefunden.
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #report-content, #report-content * { visibility: visible; }
          #report-content { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
