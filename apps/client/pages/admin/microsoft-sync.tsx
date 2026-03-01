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
import { Cloud, RefreshCw, Users, Shield, UserCog, AlertCircle, CheckCircle2, Copy, Eye, EyeOff, Key } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/shadcn/hooks/use-toast";
import { Input } from "@/shadcn/ui/input";

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

  // Credentials state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);

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

  // Fetch Microsoft Graph credentials
  async function fetchCredentials() {
    setCredentialsLoading(true);
    try {
      const res = await fetch("/api/v1/config/microsoft-graph", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success && data.config) {
        setClientId(data.config.clientId || "");
        setTenantId(data.config.tenantId || "");
        setClientSecret(data.config.clientSecret || "");
        setCredentialsConfigured(
          !!(data.config.clientId && data.config.tenantId && data.config.clientSecret)
        );
      }
    } catch (err) {
      console.error("Error fetching credentials:", err);
    }
    setCredentialsLoading(false);
  }

  // Save Microsoft Graph credentials
  async function saveCredentials() {
    if (!clientId.trim() || !tenantId.trim() || !clientSecret.trim()) {
      toast({
        variant: "destructive",
        title: "Validierungsfehler",
        description: "Bitte füllen Sie alle erforderlichen Felder aus.",
      });
      return;
    }

    setCredentialsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/config/microsoft-graph", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          tenantId: tenantId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCredentialsConfigured(true);
        setSuccess("Microsoft Graph Anmeldedaten gespeichert");
        toast({
          title: "Erfolgreich gespeichert",
          description: "Die Microsoft Graph Anmeldedaten wurden aktualisiert.",
        });
      } else {
        setError(data.message || "Fehler beim Speichern");
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.message || "Fehler beim Speichern der Anmeldedaten",
        });
      }
    } catch (err: any) {
      setError("Fehler: " + err.message);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: err.message,
      });
    }
    setCredentialsSaving(false);
  }

  // Copy to clipboard
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: `${label} wurde in die Zwischenablage kopiert.`,
    });
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
    fetchCredentials();
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
            {/* Credentials Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Microsoft Graph API Anmeldedaten
                </CardTitle>
                <CardDescription>
                  Konfigurieren Sie Ihre Microsoft Graph API Anmeldedaten für die Integration mit Microsoft 365.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {credentialsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Lade Konfiguration...</span>
                  </div>
                ) : (
                  <>
                    {credentialsConfigured && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        Microsoft Graph API ist konfiguriert
                      </div>
                    )}

                    {/* Client ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Client ID
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="z.B. 12345678-1234-1234-1234-123456789012"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(clientId, "Client ID")}
                          disabled={!clientId}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tenant ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Tenant ID (Verzeichnis-ID)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={tenantId}
                          onChange={(e) => setTenantId(e.target.value)}
                          placeholder="z.B. 12345678-1234-1234-1234-123456789012"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(tenantId, "Tenant ID")}
                          disabled={!tenantId}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Client Secret */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Client Secret
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          placeholder="Ihr Client Geheimnis"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(clientSecret, "Client Secret")}
                          disabled={!clientSecret}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Help Section */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm space-y-2">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Wie Man die Anmeldedaten Erhält
                      </h4>
                      <ol className="space-y-1 text-blue-800 dark:text-blue-200 list-decimal list-inside">
                        <li>Gehen Sie zu <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="font-medium underline">Azure Portal</a></li>
                        <li>Navigieren Sie zu "App-Registrierungen"</li>
                        <li>Erstellen Sie eine neue Anwendung oder wählen Sie eine bestehende aus</li>
                        <li>Kopieren Sie die "Anwendungs-ID" (Client ID)</li>
                        <li>Gehen Sie zu "Zertifikate & Geheimnisse" und erstellen Sie einen neuen Client-Geheimnis</li>
                        <li>Kopieren Sie das Geheimnis (Wert)</li>
                        <li>Notieren Sie Ihre "Verzeichnis-ID" (Tenant ID)</li>
                      </ol>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                        <strong>API-Berechtigungen:</strong> Stellen Sie sicher, dass Ihre App die Berechtigungen "Group.Read.All" und "User.Read.All" hat.
                      </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={saveCredentials}
                        disabled={credentialsSaving}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {credentialsSaving ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Speichern...
                          </>
                        ) : (
                          "Anmeldedaten speichern"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

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
                <CardTitle>Über diese Seite</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  <strong className="text-foreground">Schritt 1: Anmeldedaten eingeben</strong><br />
                  Geben Sie Ihre Microsoft Graph API Anmeldedaten ein und speichern Sie diese. Die Anmeldedaten werden verschlüsselt in der Datenbank gespeichert.
                </p>
                <p>
                  <strong className="text-foreground">Schritt 2: Gruppen-Rollen-Zuordnung</strong><br />
                  Wählen Sie Microsoft 365 Gruppen aus und ordnen Sie diese Benutzerrollen (Benutzer, Manager, Admins) zu.
                </p>
                <p>
                  <strong className="text-foreground">Schritt 3: Synchronisierung</strong><br />
                  Führen Sie die Synchronisierung aus, um Benutzer aus Microsoft 365 Gruppen zu importieren und automatisch Rollen zuzuweisen.
                </p>
                <p className="mt-4 pt-4 border-t">
                  <strong className="text-foreground">API-Berechtigungen erforderlich:</strong>
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1">
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
