import { toast } from "@/shadcn/hooks/use-toast";
import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("");
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState();
  const [error, setError]: any = useState();
  const [templates, setTemplates] = useState([]);
  const [portalUrl, setPortalUrl] = useState("");
  const [effectiveUrl, setEffectiveUrl] = useState("");
  const [portalUrlSaving, setPortalUrlSaving] = useState(false);

  // German labels for template types
  const templateLabels: Record<string, string> = {
    ticket_assigned: "Ticket zugewiesen",
    ticket_comment: "Ticket-Kommentar",
    ticket_created: "Ticket erstellt",
    ticket_status_changed: "Ticket-Status geändert",
  };

  async function deleteEmailConfig() {
    setLoading(true);
    await fetch(`/api/v1/config/email`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then(() => {
        fetchEmailConfig();
      });
  }

  async function fetchTemplates() {
    await fetch("/api/v1/ticket/templates", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          console.log(data.templates);
          setTemplates(data.templates);
        }
      });
  }

  async function resetSMTP() {
    await fetch(`/api/v1/config/email`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then(() => {
        fetchEmailConfig();
      });
  }

  async function fetchEmailConfig() {
    await fetch(`/api/v1/config/email`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.active) {
          setEnabled(res.email.active);
          setConfig(res.email);

          if (res.verification !== true) {
            setError(res.verification);
          } else {
            fetchTemplates();
          }
        } else {
          setEnabled(false);
        }
      })
      .then(() => setLoading(false));
  }

  async function fetchPortalUrl() {
    try {
      const res = await fetch("/api/v1/config/ticket-portal-url", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setPortalUrl(data.ticketPortalUrl || "");
        setEffectiveUrl(data.effectiveUrl || "");
      }
    } catch (err) {
      console.error("Failed to fetch portal URL:", err);
    }
  }

  async function savePortalUrl() {
    setPortalUrlSaving(true);
    try {
      const res = await fetch("/api/v1/config/ticket-portal-url", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({ ticketPortalUrl: portalUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setEffectiveUrl(data.effectiveUrl || "");
        toast({
          title: "Gespeichert",
          description: "Ticket-Portal-URL wurde aktualisiert.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.message || "Konnte URL nicht speichern.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: err?.message || "Verbindungsfehler",
      });
    } finally {
      setPortalUrlSaving(false);
    }
  }

  useEffect(() => {
    fetchEmailConfig();
    fetchPortalUrl();
  }, []);

  return (
    <main className="flex-1">
      <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
        <div className="pt-10 pb-6">
          <div className="divide-y-2">
            <div className="px-4 sm:px-6 md:px-0 flex flex-row justify-between">
              <h1 className="text-3xl font-extrabold text-foreground">
                SMTP E-Mail Einstellungen
              </h1>

              <button className="text-xs" onClick={() => resetSMTP()}>
                SMTP Zurücksetzen
              </button>
            </div>
            <div className="px-4 sm:px-6 md:px-0">
              <div className="sm:flex sm:items-center mt-4">
                <div className="sm:flex-auto">
                  <p className="mt-2 text-sm text-foreground-muted">
                    Verwalten Sie Ihre SMTP E-Mail-Einstellungen. Diese werden für alle ausgehenden E-Mails verwendet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!loading ? (
          <div className="px-4 sm:px-6 md:px-0">
            {/* Ticket Portal URL Setting */}
            <div className="mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket-Portal-URL</CardTitle>
                  <CardDescription>
                    Die Basis-URL für Links in E-Mail-Benachrichtigungen (z.B. &quot;Ticket ansehen&quot;-Links).
                    Ohne diese Einstellung zeigen E-Mails auf localhost:3000.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-3">
                    <div>
                      <Label htmlFor="portalUrl">Portal URL</Label>
                      <div className="mt-1 flex rounded-md shadow-sm gap-2">
                        <Input
                          id="portalUrl"
                          type="url"
                          placeholder="https://helpdesk.example.com"
                          value={portalUrl}
                          onChange={(e) => setPortalUrl(e.target.value)}
                        />
                        <Button
                          onClick={() => savePortalUrl()}
                          disabled={portalUrlSaving}
                          size="sm"
                        >
                          {portalUrlSaving ? "Speichern..." : "Speichern"}
                        </Button>
                      </div>
                    </div>
                    {effectiveUrl && (
                      <p className="text-xs text-muted-foreground">
                        Aktive URL: <span className="font-mono">{effectiveUrl}</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mb-6">
              {enabled ? (
                <div>
                  {!error ? (
                    <div>
                      <div className="rounded-md bg-green-50 p-4">
                        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <ExclamationTriangleIcon
                                className="h-5 w-5 text-green-400"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-green-800">
                                SMTP Konfiguration gefunden & funktioniert
                              </h3>
                              <div className="mt-2 text-sm text-green-700">
                                <p>
                                  Die angegebene Konfiguration funktioniert wie erwartet.
                                </p>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteEmailConfig()}
                            type="button"
                            className="rounded bg-red-500 text-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-secondary"
                          >
                            Einstellungen löschen
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h1>E-Mail Vorlagen</h1>
                        <table>
                          <tbody>
                            {templates.map((template: any) => (
                              <tr key={template.id}>
                                <td>{templateLabels[template.type] || template.type}</td>
                                <td>{template.subject}</td>
                                <td>{template.html}</td>
                                <td>
                                  <a
                                    href={`/admin/smtp/templates/${template.id}`}
                                  >
                                    Bearbeiten
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="rounded-md bg-red-50 p-4">
                        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <ExclamationTriangleIcon
                                className="h-5 w-5 text-red-400"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-red-800">
                                Authentifizierungsfehler
                              </h3>
                              <div className="mt-2 text-sm text-red-700">
                                <p>
                                  {error?.message ||
                                    "Ein unbekannter Fehler ist aufgetreten."}
                                </p>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => deleteEmailConfig()}
                            type="button"
                            className="rounded bg-red-500 text-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-secondary"
                          >
                            Einstellungen löschen
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 ml-0.5 flex flex-col">
                        <span className="text-sm font-semibold">
                          Verifizierungsstatus
                        </span>
                        <span className="text-xs font-semibold">
                          Code: {error && error.code}
                        </span>
                        <span className="text-xs font-semibold">
                          Code: {error && error.response}
                        </span>
                        <span className="text-xs font-semibold">
                          Code: {error && error.responseCode}
                        </span>
                        <span className="text-xs font-semibold">
                          Code: {error && error.command}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-y-4 mt-8 justify-center items-center">
                    {step === 0 && (
                      <Card className="w-[350px]">
                        <CardHeader>
                          <CardTitle>E-Mail Anbieter</CardTitle>
                          <CardDescription>
                            Bestimmte Anbieter erfordern unterschiedliche Einstellungen.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                              <Label htmlFor="framework">Anbieter</Label>
                              <Select
                                onValueChange={(value) => setProvider(value)}
                              >
                                <SelectTrigger id="framework">
                                  <SelectValue placeholder="Auswählen" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  <SelectItem disabled value="microsoft">
                                    Microsoft
                                  </SelectItem>
                                  <SelectItem value="gmail">Google</SelectItem>
                                  <SelectItem value="other">Andere</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button variant="outline">Cancel</Button>
                          <Button
                            disabled={provider === ""}
                            onClick={() => setStep(1)}
                          >
                            Next
                          </Button>
                        </CardFooter>
                      </Card>
                    )}
                    {step === 1 && provider === "microsoft" && (
                      <MicrosoftSettings />
                    )}
                    {step === 1 && provider === "gmail" && (
                      <GmailSettings setStep={setStep} />
                    )}
                    {step === 1 && provider === "other" && (
                      <SMTP setStep={setStep} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div>Laden...</div>
        )}
      </div>
    </main>
  );
}

function MicrosoftSettings() {
  return <div>Microsoft</div>;
}

function GmailSettings({ setStep }: { setStep: (step: number) => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    `${window.location.origin}/admin/smtp/oauth`
  );
  const [user, setUser] = useState("");

  const router = useRouter();

  async function submitGmailConfig() {
    await fetch(`/api/v1/config/email`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("session")}`,
      },
      body: JSON.stringify({
        host: "smtp.gmail.com",
        port: "465",
        clientId,
        clientSecret,
        username: user,
        reply: user,
        serviceType: "gmail",
        redirectUri: redirectUri,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.authorizeUrl) {
          router.push(res.authorizeUrl);
        }
      });
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Gmail Einstellungen</CardTitle>
        <CardDescription>Konfigurieren Sie Ihre Gmail OAuth2-Einstellungen.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-4">
            <div className="">
              <label
                htmlFor="client_id"
                className="block text-sm font-medium text-foreground"
              >
                Client ID
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  name="client_id"
                  id="client_id"
                  className="flex-1 text-foreground text-sm bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="Your Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="client_secret"
                className="block text-sm font-medium text-foreground"
              >
                Client Secret
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  name="client_secret"
                  id="client_secret"
                  className="flex-1 text-foreground text-sm bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="Your Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="user_email"
                className="block text-sm font-medium text-foreground"
              >
                User Email
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="email"
                  name="user_email"
                  id="user_email"
                  className="flex-1 text-foreground text-sm bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="Your Email"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="user_email"
                className="block text-sm font-medium text-foreground"
              >
                Redirect URI
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  name="redirect_uri"
                  id="redirect_uri"
                  className="flex-1 text-foreground text-sm bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="Your Redirect URI"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button size="sm" variant="outline" onClick={() => setStep(0)}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={!clientId || !clientSecret || !user}
          onClick={() => submitGmailConfig()}
        >
          Submit
        </Button>
      </CardFooter>
    </Card>
  );
}

function SMTP({ setStep }: { setStep: (step: number) => void }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [reply, setReply] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [supportMailbox, setSupportMailbox] = useState("");

  const router = useRouter();

  async function submitConfig() {
    try {
      const res = await fetch(`/api/v1/config/email`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({
          host,
          active: true,
          port,
          reply,
          username,
          password,
          serviceType: "other",
          supportMailbox: supportMailbox || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({
          variant: "destructive",
          title: "Fehler beim Speichern",
          description: data.error || data.message || "Unbekannter Fehler",
        });
        return;
      }
      toast({
        title: "Gespeichert",
        description: "SMTP Einstellungen wurden erfolgreich gespeichert.",
      });
      router.reload();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: err?.message || "Verbindungsfehler",
      });
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>SMTP Einstellungen</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-4">
            <div className="">
              <label
                htmlFor="company_website"
                className="block text-sm font-medium text-foreground"
              >
                SMTP Host
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  name="company_website"
                  id="company_website"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="smtp.gmail.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="company_website"
                className="block text-sm font-medium text-foreground"
              >
                Username
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="email"
                  name="company_website"
                  id="company_website"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="company_website"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="password"
                  name="company_website"
                  id="company_website"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="company_website"
                className="block text-sm font-medium text-foreground"
              >
                Port
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="number"
                  name="company_website"
                  id="company_website"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="465"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="company_website"
                className="block text-sm font-medium text-foreground"
              >
                Reply Address
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="email"
                  name="company_website"
                  id="company_website"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="reply@example.com"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
              </div>
            </div>

            <div className="">
              <label
                htmlFor="support_mailbox"
                className="block text-sm font-medium text-foreground"
              >
                Support Mailbox (BCC)
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="email"
                  name="support_mailbox"
                  id="support_mailbox"
                  className="flex-1 text-foreground text-sm  bg-transparent focus:ring-green-500 focus:border-green-500 block w-full min-w-0 rounded-md"
                  placeholder="support-team@example.com"
                  value={supportMailbox}
                  onChange={(e) => setSupportMailbox(e.target.value)}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Diese Adresse erhält eine Kopie aller ausgehenden E-Mails.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button size="sm" variant="outline" onClick={() => setStep(0)}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={!host || !port || !username || !password || !reply}
          onClick={() => submitConfig()}
        >
          Submit
        </Button>
      </CardFooter>
    </Card>
  );
}
