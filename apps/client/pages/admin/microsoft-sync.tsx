import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";
import { getCookie } from "cookies-next";
import { Cloud, RefreshCw, Users, Shield, UserCog, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

interface M365Group {
  id: string;
  displayName: string;
  description?: string;
  mail?: string;
}

interface GroupMapping {
  usersGroupId?: string;
  usersGroupName?: string;
  managersGroupId?: string;
  managersGroupName?: string;
  adminsGroupId?: string;
  adminsGroupName?: string;
}

interface SyncPreview {
  users: { toCreate: string[]; existing: string[] };
  managers: { toCreate: string[]; existing: string[] };
  admins: { toCreate: string[]; existing: string[] };
  errors: string[];
}

interface SyncResult {
  users: { created: number; existing: number; updated: number };
  managers: { created: number; existing: number; updated: number };
  admins: { created: number; existing: number; updated: number };
  errors: string[];
}

export default function MicrosoftSync() {
  const [groups, setGroups] = useState<M365Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mapping, setMapping] = useState<GroupMapping>({});
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Fetch M365 groups
  async function fetchGroups() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/microsoft-graph/groups", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
      } else {
        setError(data.message || "Fehler beim Laden der Gruppen");
      }
    } catch (err: any) {
      setError("Verbindungsfehler: " + err.message);
    }
    setLoading(false);
  }

  // Fetch current mapping
  async function fetchMapping() {
    try {
      const res = await fetch("/api/v1/admin/microsoft-graph/group-mapping", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success && data.mapping) {
        setMapping(data.mapping);
      }
    } catch (err) {
      console.error("Error fetching mapping:", err);
    }
  }

  // Save mapping
  async function saveMapping() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/admin/microsoft-graph/group-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify(mapping),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Zuordnung gespeichert");
      } else {
        setError(data.message || "Fehler beim Speichern");
      }
    } catch (err: any) {
      setError("Fehler: " + err.message);
    }
    setSaving(false);
  }

  // Preview sync
  async function fetchPreview() {
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/microsoft-graph/sync-preview", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview);
      } else {
        setError(data.message || "Fehler bei der Vorschau");
      }
    } catch (err: any) {
      setError("Fehler: " + err.message);
    }
  }

  // Execute sync
  async function executeSync() {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/v1/admin/microsoft-graph/sync-groups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.result);
        setSuccess("Synchronisation abgeschlossen");
      } else {
        setError(data.message || "Fehler bei der Synchronisation");
      }
    } catch (err: any) {
      setError("Fehler: " + err.message);
    }
    setSyncing(false);
  }

  // Update mapping when group selection changes
  function updateGroupMapping(role: "users" | "managers" | "admins", groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (role === "users") {
      setMapping((prev) => ({
        ...prev,
        usersGroupId: groupId,
        usersGroupName: group?.displayName,
      }));
    } else if (role === "managers") {
      setMapping((prev) => ({
        ...prev,
        managersGroupId: groupId,
        managersGroupName: group?.displayName,
      }));
    } else {
      setMapping((prev) => ({
        ...prev,
        adminsGroupId: groupId,
        adminsGroupName: group?.displayName,
      }));
    }
  }

  useEffect(() => {
    fetchGroups();
    fetchMapping();
  }, []);

  return (
    <main className="flex-1">
      <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
        <div className="pt-10 pb-16">
          <div className="px-4 sm:px-6 md:px-0">
            <div className="flex items-center gap-3 mb-2">
              <Cloud className="h-8 w-8 text-blue-500" />
              <h1 className="text-3xl font-extrabold text-foreground">
                Microsoft 365 Benutzersynchronisation
              </h1>
            </div>
            <p className="text-muted-foreground">
              Synchronisieren Sie Benutzer aus Microsoft 365 Gruppen und weisen Sie automatisch Rollen zu.
            </p>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="mt-4 px-4 sm:px-6 md:px-0">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            </div>
          )}
          {success && (
            <div className="mt-4 px-4 sm:px-6 md:px-0">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                {success}
              </div>
            </div>
          )}

          <div className="mt-8 px-4 sm:px-6 md:px-0 space-y-6">
            {/* Group Mapping Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gruppen-Rollen-Zuordnung
                </CardTitle>
                <CardDescription>
                  Wählen Sie Microsoft 365 Gruppen für jede Benutzerrolle aus.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Lade Gruppen...</span>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Keine Microsoft 365 Gruppen gefunden.</p>
                    <p className="text-sm mt-2">
                      Stellen Sie sicher, dass die Microsoft Graph API konfiguriert ist.
                    </p>
                    <Button onClick={fetchGroups} variant="outline" className="mt-4">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Erneut laden
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Users Group */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-32">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Benutzer</span>
                      </div>
                      <Select
                        value={mapping.usersGroupId || ""}
                        onValueChange={(value) => updateGroupMapping("users", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Gruppe auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Managers Group */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-32">
                        <UserCog className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Manager</span>
                      </div>
                      <Select
                        value={mapping.managersGroupId || ""}
                        onValueChange={(value) => updateGroupMapping("managers", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Gruppe auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Admins Group */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-32">
                        <Shield className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Admins</span>
                      </div>
                      <Select
                        value={mapping.adminsGroupId || ""}
                        onValueChange={(value) => updateGroupMapping("admins", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Gruppe auswählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={saveMapping} disabled={saving}>
                        {saving ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Speichern...
                          </>
                        ) : (
                          "Zuordnung speichern"
                        )}
                      </Button>
                      <Button onClick={fetchGroups} variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Gruppen aktualisieren
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sync Preview Card */}
            <Card>
              <CardHeader>
                <CardTitle>Synchronisations-Vorschau</CardTitle>
                <CardDescription>
                  Zeigt an, welche Benutzer erstellt oder aktualisiert werden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchPreview} variant="outline" className="mb-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Vorschau laden
                </Button>

                {preview && (
                  <div className="space-y-4">
                    {/* Users Preview */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Benutzer
                      </h4>
                      <div className="mt-2 text-sm">
                        <p className="text-green-600 dark:text-green-400">
                          Neu: {preview.users.toCreate.length}
                          {preview.users.toCreate.length > 0 && (
                            <span className="text-muted-foreground ml-2">
                              ({preview.users.toCreate.slice(0, 3).join(", ")}
                              {preview.users.toCreate.length > 3 && "..."})
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          Bereits vorhanden: {preview.users.existing.length}
                        </p>
                      </div>
                    </div>

                    {/* Managers Preview */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-orange-500" />
                        Manager
                      </h4>
                      <div className="mt-2 text-sm">
                        <p className="text-green-600 dark:text-green-400">
                          Neu: {preview.managers.toCreate.length}
                          {preview.managers.toCreate.length > 0 && (
                            <span className="text-muted-foreground ml-2">
                              ({preview.managers.toCreate.slice(0, 3).join(", ")}
                              {preview.managers.toCreate.length > 3 && "..."})
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          Bereits vorhanden: {preview.managers.existing.length}
                        </p>
                      </div>
                    </div>

                    {/* Admins Preview */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        Administratoren
                      </h4>
                      <div className="mt-2 text-sm">
                        <p className="text-green-600 dark:text-green-400">
                          Neu: {preview.admins.toCreate.length}
                          {preview.admins.toCreate.length > 0 && (
                            <span className="text-muted-foreground ml-2">
                              ({preview.admins.toCreate.slice(0, 3).join(", ")}
                              {preview.admins.toCreate.length > 3 && "..."})
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          Bereits vorhanden: {preview.admins.existing.length}
                        </p>
                      </div>
                    </div>

                    {preview.errors.length > 0 && (
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                        <h4 className="font-medium text-red-700 dark:text-red-400">Fehler</h4>
                        <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                          {preview.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execute Sync Card */}
            <Card>
              <CardHeader>
                <CardTitle>Synchronisation ausführen</CardTitle>
                <CardDescription>
                  Erstellt neue Benutzer und aktualisiert bestehende Rollen basierend auf der Gruppenzuordnung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={executeSync}
                  disabled={syncing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Synchronisiere...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Jetzt synchronisieren
                    </>
                  )}
                </Button>

                {syncResult && (
                  <div className="mt-4 space-y-3">
                    <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                      <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">
                        Synchronisation abgeschlossen
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Benutzer</p>
                          <p>Erstellt: {syncResult.users.created}</p>
                          <p>Aktualisiert: {syncResult.users.updated}</p>
                        </div>
                        <div>
                          <p className="font-medium">Manager</p>
                          <p>Erstellt: {syncResult.managers.created}</p>
                          <p>Aktualisiert: {syncResult.managers.updated}</p>
                        </div>
                        <div>
                          <p className="font-medium">Admins</p>
                          <p>Erstellt: {syncResult.admins.created}</p>
                          <p>Aktualisiert: {syncResult.admins.updated}</p>
                        </div>
                      </div>
                    </div>

                    {syncResult.errors.length > 0 && (
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                        <h4 className="font-medium text-red-700 dark:text-red-400">Fehler während der Synchronisation</h4>
                        <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                          {syncResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle>Konfiguration</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Voraussetzungen:</strong> Microsoft Graph API muss konfiguriert sein.
                </p>
                <p>Setzen Sie folgende Umgebungsvariablen:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><code className="bg-muted px-1 rounded">MS_GRAPH_CLIENT_ID</code> - Azure App Client ID</li>
                  <li><code className="bg-muted px-1 rounded">MS_GRAPH_CLIENT_SECRET</code> - Azure App Client Secret</li>
                  <li><code className="bg-muted px-1 rounded">MS_GRAPH_TENANT_ID</code> - Azure Tenant ID</li>
                </ul>
                <p className="mt-4">
                  <strong>Azure App Berechtigungen:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Group.Read.All (Application)</li>
                  <li>User.Read.All (Application)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
