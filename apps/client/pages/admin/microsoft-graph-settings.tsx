import { toast } from "@/shadcn/hooks/use-toast";
import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import { getCookie } from "cookies-next";
import { Cloud, Copy, Info } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function MicrosoftGraphSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/config/microsoft-graph", {
        headers: {
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setClientId(data.clientId || "");
        setClientSecret(data.clientSecret || "");
        setTenantId(data.tenantId || "");
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.message || "Fehler beim Laden der Konfiguration",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message || "Verbindungsfehler",
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!clientId || !clientSecret || !tenantId) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Alle Felder sind erforderlich",
      });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/v1/config/microsoft-graph", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({
          clientId,
          clientSecret,
          tenantId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Erfolg",
          description: "Microsoft Graph Konfiguration wurde gespeichert",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.message || "Fehler beim Speichern",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message || "Verbindungsfehler",
      });
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: `${label} wurde in die Zwischenablage kopiert`,
    });
  }

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
      <main className="flex-1">
        <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
          <div className="pt-10 pb-16">
            <div className="px-4 sm:px-6 md:px-0">
              <div className="flex items-center gap-3 mb-2">
                <Cloud className="h-8 w-8 text-blue-500" />
                <h1 className="text-3xl font-extrabold text-foreground">
                  Microsoft Graph API Konfiguration
                </h1>
              </div>
              <p className="text-muted-foreground mt-2">
                Konfigurieren Sie die Microsoft Graph API-Anmeldedaten für die Integration mit Microsoft 365.
              </p>
            </div>

            <div className="px-4 sm:px-6 md:px-0 my-8">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="max-w-2xl space-y-6">
                  {/* Info Card */}
                  <Card className="border-blue-200 bg-blue-50 dark:bg-transparent">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <CardTitle className="text-blue-900 dark:text-blue-400">
                            Wie Man die Anmeldedaten Erhält
                          </CardTitle>
                          <CardDescription className="text-blue-800 dark:text-blue-300 mt-2">
                            <ol className="list-decimal list-inside space-y-2 mt-2">
                              <li>Gehen Sie zu <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Azure Portal</a></li>
                              <li>Wählen Sie &quot;App Registrierungen&quot;</li>
                              <li>Erstellen Sie eine neue Anwendung oder wählen Sie eine bestehende aus</li>
                              <li>Kopieren Sie die &quot;Application (Client) ID&quot;</li>
                              <li>Gehen Sie zu &quot;Zertifikate & Geheimnisse&quot; und erstellen Sie einen neuen Client-Geheimnis</li>
                              <li>Kopieren Sie das Geheimnis (Wert)</li>
                              <li>Notieren Sie Ihre &quot;Verzeichnis-(Mandanten-)ID&quot; (direkte Übersicht)</li>
                            </ol>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Configuration Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>API-Anmeldedaten</CardTitle>
                      <CardDescription>
                        Geben Sie Ihre Microsoft Graph API-Anmeldedaten ein
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Client ID */}
                      <div className="space-y-2">
                        <Label htmlFor="clientId" className="text-base font-semibold">
                          Client ID
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="clientId"
                            placeholder="z.B. 12345678-1234-1234-1234-123456789012"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="font-mono text-sm"
                            disabled={saving}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(clientId, "Client ID")}
                            disabled={!clientId}
                            className="flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Die eindeutige ID Ihrer Azure-Anwendung (Application ID)
                        </p>
                      </div>

                      {/* Tenant ID */}
                      <div className="space-y-2">
                        <Label htmlFor="tenantId" className="text-base font-semibold">
                          Tenant ID (Verzeichnis-ID)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="tenantId"
                            placeholder="z.B. 12345678-1234-1234-1234-123456789012"
                            value={tenantId}
                            onChange={(e) => setTenantId(e.target.value)}
                            className="font-mono text-sm"
                            disabled={saving}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(tenantId, "Tenant ID")}
                            disabled={!tenantId}
                            className="flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ihre Microsoft Entra ID Mandanten-ID
                        </p>
                      </div>

                      {/* Client Secret */}
                      <div className="space-y-2">
                        <Label htmlFor="clientSecret" className="text-base font-semibold">
                          Client Secret
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="clientSecret"
                            placeholder="Ihr Client-Geheimnis"
                            type={showSecret ? "text" : "password"}
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            className="font-mono text-sm"
                            disabled={saving}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSecret(!showSecret)}
                            disabled={saving}
                            className="flex-shrink-0"
                          >
                            {showSecret ? "Ausblenden" : "Anzeigen"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(clientSecret, "Client Secret")}
                            disabled={!clientSecret}
                            className="flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Das Geheimnis ist erforderlich für die API-Authentifizierung. Behandeln Sie diese wie ein Passwort.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Connection Test Info */}
                  <Card className="border-amber-200 bg-amber-50 dark:bg-transparent">
                    <CardHeader>
                      <CardTitle className="text-amber-900 dark:text-amber-400 text-base">
                        ⚙️ Verbindungstest
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-amber-800 dark:text-amber-300">
                      Nach dem Speichern können Sie auf der{" "}
                      <a href="/admin/microsoft-sync" className="underline font-semibold">
                        Microsoft 365-Synchronisierungsseite
                      </a>{" "}
                      testen, ob die Einstellungen funktionieren, indem Sie versuchen, Gruppen zu laden.
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={saveConfig}
                      disabled={saving || !clientId || !clientSecret || !tenantId}
                      size="lg"
                      className="flex-1"
                    >
                      {saving ? "Speichern..." : "Konfiguration Speichern"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={fetchConfig}
                      disabled={saving}
                      size="lg"
                    >
                      Zurücksetzen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
  );
}
