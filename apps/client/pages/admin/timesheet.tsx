import { getCookie } from "cookies-next";
import moment from "moment";
import { useEffect, useState } from "react";
import { useQuery } from "react-query";
import { Button } from "@/shadcn/ui/button";
import { useUser } from "../../store/session";
import { useRouter } from "next/router";
import { Clock, Download } from "lucide-react";

function formatMinutes(min: number) {
  if (!min) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m > 0 ? m + " Min." : ""}`;
}

function formatHours(min: number) {
  return (min / 60).toFixed(2).replace(".", ",");
}

const fetchUsers = async () => {
  const res = await fetch(`/api/v1/users/all`, {
    headers: { Authorization: `Bearer ${getCookie("session")}` },
  });
  return res.json();
};

const fetchClients = async () => {
  const res = await fetch(`/api/v1/clients/all`, {
    headers: { Authorization: `Bearer ${getCookie("session")}` },
  });
  return res.json();
};

export default function TimesheetPage() {
  const router = useRouter();
  const { user } = useUser();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [fetchEnabled, setFetchEnabled] = useState(false);

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.push("/");
    }
  }, [user]);

  const { data: usersData } = useQuery("all-users-timesheet", fetchUsers);
  const { data: clientsData } = useQuery("all-clients-timesheet", fetchClients);

  const {
    data: timeData,
    isFetching,
    refetch,
  } = useQuery(
    ["timesheet", year, month, userId, clientId],
    async () => {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        ...(userId ? { userId } : {}),
        ...(clientId ? { clientId } : {}),
      });
      const res = await fetch(`/api/v1/time/all?${params}`, {
        headers: { Authorization: `Bearer ${getCookie("session")}` },
      });
      return res.json();
    },
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
      ...(userId ? { userId } : {}),
      ...(clientId ? { clientId } : {}),
    });
    const token = getCookie("session");
    fetch(`/api/v1/time/export/csv?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Zeiterfassung_${year}_${String(month).padStart(2, "0")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const entries = timeData?.entries ?? [];

  const totalMinutes = entries.reduce(
    (sum: number, e: any) => sum + (e.time || 0),
    0
  );

  // Group by date for display
  const grouped: Record<string, any[]> = {};
  for (const e of entries) {
    const date = moment(e.createdAt).format("YYYY-MM-DD");
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  }
  const sortedDates = Object.keys(grouped).sort();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = [
    { v: 1, l: "Januar" },
    { v: 2, l: "Februar" },
    { v: 3, l: "März" },
    { v: 4, l: "April" },
    { v: 5, l: "Mai" },
    { v: 6, l: "Juni" },
    { v: 7, l: "Juli" },
    { v: 8, l: "August" },
    { v: 9, l: "September" },
    { v: 10, l: "Oktober" },
    { v: 11, l: "November" },
    { v: 12, l: "Dezember" },
  ];

  const monthName = months.find((m) => m.v === month)?.l ?? "";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Zeiterfassung</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Jahr</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Monat</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m.v} value={m.v}>
                {m.l}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Benutzer (optional)</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background min-w-[200px]"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Alle Benutzer</option>
            {usersData?.users?.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Kunde (optional)</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background min-w-[200px]"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Alle Kunden</option>
            {clientsData?.clients?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={handleGenerate} disabled={isFetching}>
          {isFetching ? "Lädt…" : "Anzeigen"}
        </Button>

        {entries.length > 0 && (
          <Button variant="outline" onClick={handleDownloadCsv}>
            <Download className="h-4 w-4 mr-1" />
            CSV Export
          </Button>
        )}
      </div>

      {/* Summary bar */}
      {entries.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-wrap gap-6">
          <div>
            <div className="text-xs text-muted-foreground">Zeitraum</div>
            <div className="font-semibold">
              {monthName} {year}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Einträge</div>
            <div className="font-semibold">{entries.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Gesamt</div>
            <div className="font-semibold">{formatMinutes(totalMinutes)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Stunden (dezimal)</div>
            <div className="font-semibold">{formatHours(totalMinutes)} h</div>
          </div>
        </div>
      )}

      {/* Timesheet table grouped by date */}
      {entries.length > 0 && (
        <div className="space-y-4">
          {sortedDates.map((date) => {
            const dayEntries = grouped[date];
            const dayTotal = dayEntries.reduce(
              (s: number, e: any) => s + (e.time || 0),
              0
            );
            return (
              <div key={date} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex justify-between items-center">
                  <span className="font-semibold text-sm">
                    {moment(date).format("dddd, DD.MM.YYYY")}
                  </span>
                  <span className="text-sm font-medium">
                    {formatMinutes(dayTotal)} ({formatHours(dayTotal)} h)
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left px-4 py-1.5">Benutzer</th>
                      <th className="text-left px-4 py-1.5">Ticket</th>
                      <th className="text-left px-4 py-1.5">Kunde</th>
                      <th className="text-left px-4 py-1.5">Beschreibung</th>
                      <th className="text-right px-4 py-1.5">Minuten</th>
                      <th className="text-right px-4 py-1.5">Stunden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEntries.map((e: any) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-4 py-2">{e.user?.name ?? "–"}</td>
                        <td className="px-4 py-2">
                          {e.ticket ? (
                            <a
                              href={`/issue/${e.ticket.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              #{e.ticket.Number} {e.ticket.title}
                            </a>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {e.ticket?.client?.name ?? "–"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {e.title || "–"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {e.time}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatHours(e.time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {fetchEnabled && !isFetching && entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Keine Zeiteinträge für diesen Zeitraum gefunden.
        </div>
      )}
    </div>
  );
}
