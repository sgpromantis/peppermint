import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/ui/popover";
import { getCookie } from "cookies-next";
import { Cloud, RefreshCw, Users, Shield, UserCog, AlertCircle, CheckCircle2, ChevronsUpDown, Check } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "@/shadcn/hooks/use-toast";
import { cn } from "@/shadcn/lib/utils";
import Link from "next/link";

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

  // Credentials status
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);

  const [mapping, setMapping] = useState<GroupMapping>({});
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Combobox open states
  const [usersOpen, setUsersOpen] = useState(false);
  const [managersOpen, setManagersOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);

  // Search/filter state per combobox
  const [usersSearch, setUsersSearch] = useState("");
  const [managersSearch, setManagersSearch] = useState("");
  const [adminsSearch, setAdminsSearch] = useState("");

  // Manual input state (for pasting group name/mail when not in list)
  const [usersManualInput, setUsersManualInput] = useState("");
  const [managersManualInput, setManagersManualInput] = useState("");
  const [adminsManualInput, setAdminsManualInput] = useState("");

  // Filter groups based on search text
  const filterGroups = useCallback((search: string) => {
    if (!search) return groups;
    const lower = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.displayName?.toLowerCase().includes(lower) ||
        g.mail?.toLowerCase().includes(lower) ||
        g.id?.toLowerCase().includes(lower)
    );
  }, [groups]);

  // Get display label for a selected group
  const getGroupLabel = (groupId: string | undefined, groupName: string | undefined) => {
    if (!groupId) return "";
    const group = groups.find((g) => g.id === groupId);
    if (group) return group.displayName;
    return groupName || groupId;
  };

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

  // Check if Microsoft Graph credentials are configured
  async function checkCredentials() {
    try {
      const res = await fetch("/api/v1/config/microsoft-graph", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success && data.config) {
        setCredentialsConfigured(
          !!(data.config.clientId && data.config.tenantId && data.config.clientSecret)
        );
      }
    } catch (err) {
      console.error("Error checking credentials:", err);
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

  // Update mapping when group selection changes (from combobox)
  function updateGroupMapping(role: "users" | "managers" | "admins", groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (role === "users") {
      setMapping((prev) => ({
        ...prev,
        usersGroupId: groupId,
        usersGroupName: group?.displayName,
      }));
      setUsersManualInput("");
      setUsersOpen(false);
    } else if (role === "managers") {
      setMapping((prev) => ({
        ...prev,
        managersGroupId: groupId,
        managersGroupName: group?.displayName,
      }));
      setManagersManualInput("");
      setManagersOpen(false);
    } else {
      setMapping((prev) => ({
        ...prev,
        adminsGroupId: groupId,
        adminsGroupName: group?.displayName,
      }));
      setAdminsManualInput("");
      setAdminsOpen(false);
    }
  }

  // Resolve a group by name or mail (for manual input / paste)
  async function resolveGroupByNameOrMail(role: "users" | "managers" | "admins", input: string) {
    if (!input.trim()) return;

    // First try to find in already-loaded groups
    const lower = input.trim().toLowerCase();
    const localMatch = groups.find(
      (g) =>
        g.displayName?.toLowerCase() === lower ||
        g.mail?.toLowerCase() === lower
    );

    if (localMatch) {
      updateGroupMapping(role, localMatch.id);
      toast({
        title: "Gruppe gefunden",
        description: `"${localMatch.displayName}" wurde zugeordnet.`,
      });
      return;
    }

    // If not found locally, search via API
    try {
      const res = await fetch(
        `/api/v1/admin/microsoft-graph/groups/search?q=${encodeURIComponent(input.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${getCookie("session")}`,
          },
        }
      );
      const data = await res.json();
      if (data.success && data.groups?.length > 0) {
        // Find exact match first
        const exactMatch = data.groups.find(
          (g: M365Group) =>
            g.displayName?.toLowerCase() === lower ||
            g.mail?.toLowerCase() === lower
        );
        const match = exactMatch || data.groups[0];

        // Add to local groups list if not there yet
        if (!groups.find((g) => g.id === match.id)) {
          setGroups((prev) => [...prev, match]);
        }

        updateGroupMapping(role, match.id);
        toast({
          title: "Gruppe gefunden",
          description: `"${match.displayName}" wurde zugeordnet.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Gruppe nicht gefunden",
          description: `Keine Gruppe mit dem Namen oder der Mail "${input.trim()}" gefunden.`,
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Fehler bei der Suche",
        description: err.message,
      });
    }
  }

  useEffect(() => {
    fetchGroups();
    fetchMapping();
    checkCredentials();
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
            {/* Credentials status banner */}
            {!credentialsConfigured && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center gap-3 text-orange-700 dark:text-orange-400 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  Microsoft Graph API Anmeldedaten sind nicht konfiguriert.{" "}
                  <Link href="/admin/microsoft-graph-settings" className="font-medium underline">
                    Jetzt konfigurieren
                  </Link>
                </span>
              </div>
            )}

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
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {groups.length} Gruppen geladen. Sie können in der Liste suchen oder einen Gruppennamen / eine E-Mail-Adresse einfügen.
                    </p>

                    {/* Users Group */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Benutzer</span>
                      </div>
                      <div className="flex gap-2">
                        <Popover open={usersOpen} onOpenChange={setUsersOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={usersOpen}
                              className="flex-1 justify-between font-normal"
                            >
                              <span className="truncate">
                                {mapping.usersGroupId
                                  ? getGroupLabel(mapping.usersGroupId, mapping.usersGroupName)
                                  : "Gruppe auswählen oder suchen..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[500px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Gruppenname oder E-Mail suchen..."
                                value={usersSearch}
                                onValueChange={setUsersSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="py-2 text-sm">
                                    Keine Gruppe gefunden.
                                    <br />
                                    <button
                                      className="text-blue-500 underline mt-1"
                                      onClick={() => {
                                        if (usersSearch.trim()) {
                                          resolveGroupByNameOrMail("users", usersSearch);
                                        }
                                      }}
                                    >
                                      "{usersSearch}" in Azure AD suchen
                                    </button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup className="max-h-[300px] overflow-auto">
                                  {filterGroups(usersSearch).map((group) => (
                                    <CommandItem
                                      key={group.id}
                                      value={group.id}
                                      onSelect={() => updateGroupMapping("users", group.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          mapping.usersGroupId === group.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{group.displayName}</span>
                                        {group.mail && (
                                          <span className="text-xs text-muted-foreground">{group.mail}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Oder Gruppenname / E-Mail hier einfügen..."
                          value={usersManualInput}
                          onChange={(e) => setUsersManualInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              resolveGroupByNameOrMail("users", usersManualInput);
                            }
                          }}
                          className="flex-1 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveGroupByNameOrMail("users", usersManualInput)}
                          disabled={!usersManualInput.trim()}
                        >
                          Zuordnen
                        </Button>
                      </div>
                    </div>

                    {/* Managers Group */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Manager</span>
                      </div>
                      <div className="flex gap-2">
                        <Popover open={managersOpen} onOpenChange={setManagersOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={managersOpen}
                              className="flex-1 justify-between font-normal"
                            >
                              <span className="truncate">
                                {mapping.managersGroupId
                                  ? getGroupLabel(mapping.managersGroupId, mapping.managersGroupName)
                                  : "Gruppe auswählen oder suchen..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[500px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Gruppenname oder E-Mail suchen..."
                                value={managersSearch}
                                onValueChange={setManagersSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="py-2 text-sm">
                                    Keine Gruppe gefunden.
                                    <br />
                                    <button
                                      className="text-blue-500 underline mt-1"
                                      onClick={() => {
                                        if (managersSearch.trim()) {
                                          resolveGroupByNameOrMail("managers", managersSearch);
                                        }
                                      }}
                                    >
                                      "{managersSearch}" in Azure AD suchen
                                    </button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup className="max-h-[300px] overflow-auto">
                                  {filterGroups(managersSearch).map((group) => (
                                    <CommandItem
                                      key={group.id}
                                      value={group.id}
                                      onSelect={() => updateGroupMapping("managers", group.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          mapping.managersGroupId === group.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{group.displayName}</span>
                                        {group.mail && (
                                          <span className="text-xs text-muted-foreground">{group.mail}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Oder Gruppenname / E-Mail hier einfügen..."
                          value={managersManualInput}
                          onChange={(e) => setManagersManualInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              resolveGroupByNameOrMail("managers", managersManualInput);
                            }
                          }}
                          className="flex-1 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveGroupByNameOrMail("managers", managersManualInput)}
                          disabled={!managersManualInput.trim()}
                        >
                          Zuordnen
                        </Button>
                      </div>
                    </div>

                    {/* Admins Group */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Admins</span>
                      </div>
                      <div className="flex gap-2">
                        <Popover open={adminsOpen} onOpenChange={setAdminsOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={adminsOpen}
                              className="flex-1 justify-between font-normal"
                            >
                              <span className="truncate">
                                {mapping.adminsGroupId
                                  ? getGroupLabel(mapping.adminsGroupId, mapping.adminsGroupName)
                                  : "Gruppe auswählen oder suchen..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[500px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Gruppenname oder E-Mail suchen..."
                                value={adminsSearch}
                                onValueChange={setAdminsSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="py-2 text-sm">
                                    Keine Gruppe gefunden.
                                    <br />
                                    <button
                                      className="text-blue-500 underline mt-1"
                                      onClick={() => {
                                        if (adminsSearch.trim()) {
                                          resolveGroupByNameOrMail("admins", adminsSearch);
                                        }
                                      }}
                                    >
                                      "{adminsSearch}" in Azure AD suchen
                                    </button>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup className="max-h-[300px] overflow-auto">
                                  {filterGroups(adminsSearch).map((group) => (
                                    <CommandItem
                                      key={group.id}
                                      value={group.id}
                                      onSelect={() => updateGroupMapping("admins", group.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          mapping.adminsGroupId === group.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{group.displayName}</span>
                                        {group.mail && (
                                          <span className="text-xs text-muted-foreground">{group.mail}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Oder Gruppenname / E-Mail hier einfügen..."
                          value={adminsManualInput}
                          onChange={(e) => setAdminsManualInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              resolveGroupByNameOrMail("admins", adminsManualInput);
                            }
                          }}
                          className="flex-1 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveGroupByNameOrMail("admins", adminsManualInput)}
                          disabled={!adminsManualInput.trim()}
                        >
                          Zuordnen
                        </Button>
                      </div>
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
