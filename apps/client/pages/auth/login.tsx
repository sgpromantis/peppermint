import { toast } from "@/shadcn/hooks/use-toast";
import { setCookie } from "cookies-next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login({}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [auth, setAuth] = useState("oauth");
  const [url, setUrl] = useState("");
  const [microsoftUrl, setMicrosoftUrl] = useState("");
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  async function postData() {
    try {
      await fetch(`/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((res) => res.json())
        .then(async (res) => {
          if (res.user) {
            setCookie("session", res.token);
            // Check for saved redirect URL (e.g. from clicking an email link while logged out)
            const redirectUrl = typeof window !== "undefined" ? sessionStorage.getItem("redirectAfterLogin") : null;
            if (redirectUrl) {
              sessionStorage.removeItem("redirectAfterLogin");
              router.push(redirectUrl);
            } else if (res.user.external_user) {
              router.push("/portal");
            } else {
              router.push("/");
            }
          } else {
            toast({
              variant: "destructive",
              title: "Fehler",
              description:
                "Bei der Anmeldung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
            });
          }
        });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Datenbankfehler",
        description:
          "Es gibt ein Problem mit der Datenbank. Bitte überprüfen Sie die Docker-Logs.",
      });
    }
  }

  async function oidcLogin() {
    await fetch(`/api/v1/auth/check`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.url) {
          setUrl(res.url);
        }
      });
  }

  async function getMicrosoftLoginUrl() {
    try {
      const response = await fetch(`/api/v1/auth/microsoft/check`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (data.success && data.configured && data.url) {
        setMicrosoftUrl(data.url);
        setMicrosoftEnabled(true);
      }
    } catch (error) {
      console.error("Error fetching Microsoft login URL:", error);
    }
  }

  useEffect(() => {
    oidcLogin();
    getMicrosoftLoginUrl();
  }, []);

  useEffect(() => {
    if (router.query.error) {
      toast({
        variant: "destructive",
        title: "Kontofehler - Kein Konto gefunden",
        description:
          "Es sieht so aus, als hätten Sie versucht, sich mit SSO mit einem nicht existierenden Konto anzumelden. Bitte kontaktieren Sie Ihren Administrator.",
      });
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex flex-col items-center gap-2">
          <img src="/logo.png" alt="promantis Logo" height={80} style={{height: 80, width: 'auto'}} draggable={false} />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-foreground">
          Willkommen
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {status === "loading" ? (
          <div className="text-center mr-4">{/* <Loader size={32} /> */}</div>
        ) : (
          <div className="bg-background py-8 px-4 border border-border rounded-lg sm:px-10">
            <div className="space-y-4">
              {/* When Microsoft SSO is enabled, only show that button */}
              {microsoftEnabled && microsoftUrl ? (
                <div className="flex flex-col space-y-4">
                  {!showAdminLogin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => router.push(microsoftUrl)}
                        className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium bg-white text-gray-900 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
                          <path d="M11.573 8.066H21v10.934H11.573z" fill="#00A4EF"/>
                          <path d="M0 8.066h10.427v10.934H0z" fill="#7FBA00"/>
                          <path d="M11.573 0h10.427v9.934H11.573z" fill="#FFB900"/>
                          <path d="M0 0h10.427v9.934H0z" fill="#F25022"/>
                        </svg>
                        Mit Microsoft 365 anmelden
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setShowAdminLogin(true)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Admin-Login
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-foreground"
                        >
                          E-Mail-Adresse
                        </label>
                        <div className="mt-1">
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            onChange={(e) => setEmail(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            onKeyPress={(event) => {
                              if (event.key === "Enter") {
                                postData();
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="password"
                          className="block text-sm font-medium text-foreground"
                        >
                          Passwort
                        </label>
                        <div className="mt-1">
                          <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="password"
                            required
                            onChange={(e) => setPassword(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            onKeyPress={(event) => {
                              if (event.key === "Enter") {
                                postData();
                              }
                            }}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        onClick={postData}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Anmelden
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setShowAdminLogin(false)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          ← Zurück zu Microsoft 365
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-foreground"
                    >
                      E-Mail-Adresse
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        onKeyPress={(event) => {
                          if (event.key === "Enter") {
                            postData();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground"
                    >
                      Passwort
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="password"
                        required
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border text-gray-900 border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                        onKeyPress={(event) => {
                          if (event.key === "Enter") {
                            postData();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <Link
                        href="/auth/forgot-password"
                        className="font-medium text-primary hover:text-primary/80"
                      >
                        Passwort vergessen?
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-4">
                    <button
                      type="submit"
                      onClick={postData}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      Anmelden
                    </button>

                    {url && (
                      <button
                        type="submit"
                        onClick={() => router.push(url)}
                        className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Mit SSO anmelden
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center flex flex-col space-y-2">
          <span className="font-bold text-foreground">
            promantis Helpdesk
          </span>
        </div>
      </div>
    </div>
  );
}
