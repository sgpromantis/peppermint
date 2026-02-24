import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  MessageCircle,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { getCookie } from "cookies-next";
import { useEffect, useState } from "react";

interface Metrics {
  ticketsThisWeek: number;
  ticketsThisMonth: number;
  ticketsThisQuarter: number;
  ticketsThisYear: number;
  totalTickets: number;
  avgAssignmentTimeHours: number;
  avgResponseTimeHours: number;
  avgResolutionTimeHours: number;
  openTickets: number;
  closedTickets: number;
  unassignedTickets: number;
  resolutionRate: number;
  ticketsByPriority: { low: number; normal: number; high: number };
  ticketsByStatus: {
    needs_support: number;
    in_progress: number;
    in_review: number;
    done: number;
  };
  ticketsByType: {
    support: number;
    bug: number;
    feature: number;
    incident: number;
    service: number;
    maintenance: number;
    access: number;
  };
  userWorkload: { name: string; open: number; total: number }[];
}

interface TrendData {
  date: string;
  created: number;
  completed: number;
}

const Monitoring = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const [metricsRes, trendsRes] = await Promise.all([
        fetch("/api/v1/admin/metrics", {
          headers: { Authorization: `Bearer ${getCookie("session")}` },
        }),
        fetch("/api/v1/admin/metrics/trends", {
          headers: { Authorization: `Bearer ${getCookie("session")}` },
        }),
      ]);

      const metricsData = await metricsRes.json();
      const trendsData = await trendsRes.json();

      if (metricsData.success) setMetrics(metricsData.metrics);
      if (trendsData.success) setTrends(trendsData.trends);
    } catch (error) {
      console.error("Fehler beim Laden der Metriken:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} Min`;
    if (hours < 24) return `${hours} Std`;
    return `${Math.round(hours / 24)} Tage`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4">
        <p className="text-red-500">Fehler beim Laden der Metriken</p>
      </div>
    );
  }

  // Calculate max for bar charts
  const maxTrend = Math.max(...trends.map((t) => Math.max(t.created, t.completed)), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitoring Dashboard</h1>
        <button
          onClick={() => {
            setLoading(true);
            fetchMetrics();
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Aktualisieren
        </button>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Ø Zuweisungszeit
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(metrics.avgAssignmentTimeHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              Zeit bis zur Zuweisung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ø Antwortzeit</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(metrics.avgResponseTimeHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              Zeit bis zur ersten Antwort
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ø Lösungszeit</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(metrics.avgResolutionTimeHours)}
            </div>
            <p className="text-xs text-muted-foreground">
              Zeit bis zur Lösung
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Volume */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Diese Woche</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ticketsThisWeek}</div>
            <p className="text-xs text-muted-foreground">Tickets erstellt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dieser Monat</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ticketsThisMonth}</div>
            <p className="text-xs text-muted-foreground">Tickets erstellt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Dieses Quartal
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.ticketsThisQuarter}
            </div>
            <p className="text-xs text-muted-foreground">Tickets erstellt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dieses Jahr</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ticketsThisYear}</div>
            <p className="text-xs text-muted-foreground">Tickets erstellt</p>
          </CardContent>
        </Card>
      </div>

      {/* Current State */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Offen</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {metrics.openTickets}
            </div>
            <p className="text-xs text-muted-foreground">Aktive Tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Geschlossen</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {metrics.closedTickets}
            </div>
            <p className="text-xs text-muted-foreground">Erledigte Tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nicht zugewiesen</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {metrics.unassignedTickets}
            </div>
            <p className="text-xs text-muted-foreground">Warten auf Zuweisung</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lösungsrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {metrics.resolutionRate}%
            </div>
            <p className="text-xs text-muted-foreground">Abgeschlossen</p>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ticket-Trend (30 Tage)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {trends.map((day, index) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end gap-0.5 group relative"
              >
                <div
                  className="bg-green-500 rounded-t transition-all hover:bg-green-400"
                  style={{
                    height: `${(day.completed / maxTrend) * 100}%`,
                    minHeight: day.completed > 0 ? "4px" : "0",
                  }}
                />
                <div
                  className="bg-blue-500 rounded-t transition-all hover:bg-blue-400"
                  style={{
                    height: `${(day.created / maxTrend) * 100}%`,
                    minHeight: day.created > 0 ? "4px" : "0",
                  }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 bg-popover border rounded p-2 text-xs whitespace-nowrap z-10 pointer-events-none">
                  <div className="font-medium">
                    {new Date(day.date).toLocaleDateString("de-DE")}
                  </div>
                  <div className="text-blue-500">Erstellt: {day.created}</div>
                  <div className="text-green-500">
                    Geschlossen: {day.completed}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Erstellt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Geschlossen</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Priority Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nach Priorität</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Niedrig</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${
                        (metrics.ticketsByPriority.low / metrics.totalTickets) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-8">
                  {metrics.ticketsByPriority.low}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Normal</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500"
                    style={{
                      width: `${
                        (metrics.ticketsByPriority.normal /
                          metrics.totalTickets) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-8">
                  {metrics.ticketsByPriority.normal}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Hoch</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${
                        (metrics.ticketsByPriority.high / metrics.totalTickets) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-8">
                  {metrics.ticketsByPriority.high}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nach Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Braucht Support</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByStatus.needs_support}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">In Bearbeitung</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByStatus.in_progress}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">In Überprüfung</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByStatus.in_review}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Erledigt</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByStatus.done}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nach Typ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Support</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.support}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Fehler</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.bug}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Feature</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.feature}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Vorfall</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.incident}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Service</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.service}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Wartung</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.maintenance}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">Zugang</span>
              <span className="text-sm font-medium">
                {metrics.ticketsByType.access}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Workload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mitarbeiter-Auslastung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.userWorkload.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Keine zugewiesenen Tickets
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.userWorkload.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Activity className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">{user.open}</span>
                      <span className="text-muted-foreground">offen</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{user.total}</span>
                      <span className="text-muted-foreground">gesamt</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Monitoring;
