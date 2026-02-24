import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select";

export default function EmailQueues() {
  const [provider, setProvider] = useState("");
  const [step, setStep] = useState(0);

  return (
    <main className="flex-1">
      <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
        <div className="pt-10 pb-6">
          <div className="divide-y-2">
            <div className="px-4 sm:px-6 md:px-0">
              <h1 className="text-3xl font-extrabold text-foreground">
                Neue E-Mail Warteschlange
              </h1>
            </div>
            <div className="px-4 sm:px-6 md:px-0">
              <div className="sm:flex sm:items-center mt-4">
                <div className="sm:flex-auto">
                  <p className="mt-2 text-sm text-foreground-muted">
                    Konfigurieren Sie eine neue E-Mail-Warteschlange für ausgehende E-Mails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-y-4 mt-8 justify-center items-center">
          <div className="flex flex-col gap-y-4 mt-8 justify-center items-center">
            {step === 0 && (
              <Card className="w-[480px]">
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
                      <Select onValueChange={(value) => setProvider(value)}>
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
                  <Button variant="outline">Abbrechen</Button>
                  <Button disabled={provider === ""} onClick={() => setStep(1)}>
                    Weiter
                  </Button>
                </CardFooter>
              </Card>
            )}
            {/* {step === 1 && provider === "microsoft" && <MicrosoftSettings />} */}
            {step === 1 && provider === "gmail" && (
              <GmailSettings setStep={setStep} />
            )}
            {step === 1 && provider === "other" && (
              <PasswordProvider setStep={setStep} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function PasswordProvider({ setStep }: any) {
  const router = useRouter();

  const [name, setName]: any = useState();
  const [username, setUsername]: any = useState();
  const [password, setPassword]: any = useState();
  const [hostname, setHostname]: any = useState();
  const [tls, setTls]: any = useState();

  async function newQueue() {
    await fetch(`/api/v1/email-queue/create`, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getCookie("session"),
      },
      body: JSON.stringify({
        name,
        username,
        password,
        hostname,
        tls: tls === "true" ? true : false,
        serviceType: "other",
      }),
    })
      .then((res) => res.json())
      .then(() => {
        router.push("/admin/email-queues");
      });
  }

  return (
    <Card className="w-[480px]">
      <CardHeader>
        <CardTitle>E-Mail Warteschlangen Einstellungen</CardTitle>
        <CardDescription>Konfigurieren Sie Ihre E-Mail-Warteschlangen-Einstellungen.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-4">
            <div>
              <Label htmlFor="name">Warteschlangen-Name</Label>
              <Input
                id="name"
                placeholder="Name eingeben"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="username">Benutzername (E-Mail)</Label>
              <Input
                id="username"
                type="email"
                placeholder="E-Mail eingeben"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="Passwort eingeben"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="hostname">Hostname</Label>
              <Input
                id="hostname"
                placeholder="Hostname eingeben"
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tls">TLS</Label>
              <Select onValueChange={(value) => setTls(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="TLS-Einstellung auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ja</SelectItem>
                  <SelectItem value="false">Nein</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(0)}>
          Zurück
        </Button>
        <Button onClick={() => newQueue()}>Speichern</Button>
      </CardFooter>
    </Card>
  );
}

function GmailSettings({ setStep }: { setStep: (step: number) => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    `${window.location.origin}/admin/email-queues/oauth`
  );
  const [user, setUser] = useState("");

  const router = useRouter();

  async function submitGmailConfig() {
    await fetch(`/api/v1/email-queue/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("session")}`,
      },
      body: JSON.stringify({
        name: user,
        hostname: "imap.gmail.com",
        port: "993",
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
    <Card className="w-[480px]">
      <CardHeader>
        <CardTitle>Gmail Settings</CardTitle>
        <CardDescription>Configure your Gmail OAuth2 settings.</CardDescription>
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
