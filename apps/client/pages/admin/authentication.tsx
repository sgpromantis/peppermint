import { cn } from "@/shadcn/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shadcn/ui/alert-dialog";
import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { getCookie } from "cookies-next";
import { BellRing, Check } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Authentication() {
  const router = useRouter();

  const [isloading, setIsLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [issuer, setIssuer] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [providerType, setProviderType] = useState("");
  const [jwtSecret, setJwtSecret] = useState("");
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [microsoftRedirectUri, setMicrosoftRedirectUri] = useState("");
  const [isSavingMicrosoft, setIsSavingMicrosoft] = useState(false);

  async function postData() {
    if (providerType === "microsoft-365") {
      await saveMicrosoftConfig();
      return;
    }
    
    if (providerType === "oidc") {
      await fetch(`/api/v1/config/authentication/oidc/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({
          issuer,
          redirectUri,
          clientId,
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.success) {
            router.reload();
          }
        });
    } else {
      await fetch(`/api/v1/config/auth/oauth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
        body: JSON.stringify({
          name: provider,
          redirectUri,
          clientId,
          clientSecret,
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.success) {
            router.reload();
          }
        });
    }
  }

  async function deleteData() {
    await fetch(`/api/v1/config/authentication`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          router.reload();
        }
      });
  }

  async function checkState() {
    await fetch(`/api/v1/config/authentication/check`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.sso) {
          setEnabled(res.sso);
          setProvider(res.provider);
        } else {
          setEnabled(false);
        }
      });
  }

  async function setUri() {
    if (providerType === "oidc") {
      setRedirectUri(`${window.location.origin}/auth/oidc`);
    } else if (providerType === "oauth") {
      setRedirectUri(`${window.location.origin}/auth/oauth`);
    } else if (providerType === "microsoft-365") {
      setMicrosoftRedirectUri(`${window.location.origin}/auth/microsoft/callback`);
    }
  }

  async function checkMicrosoftStatus() {
    try {
      const res = await fetch(`/api/v1/config/authentication/azure-ad/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
      });
      const data = await res.json();
      if (data.enabled !== undefined) {
        setMicrosoftEnabled(data.enabled);
        setMicrosoftRedirectUri(data.redirectUri || `${window.location.origin}/auth/microsoft/callback`);
      }
    } catch (error) {
      console.error("Failed to check Microsoft status:", error);
    }
  }

  async function saveMicrosoftConfig() {
    if (!microsoftEnabled) {
      // Disable Microsoft 365 SSO
      setIsSavingMicrosoft(true);
      try {
        const res = await fetch(`/api/v1/config/authentication/azure-ad/disable`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("session")}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          alert("Microsoft 365 SSO has been disabled");
          setProviderType("");
        }
      } catch (error) {
        console.error("Failed to disable Microsoft SSO:", error);
        alert("Failed to disable Microsoft 365 SSO");
      } finally {
        setIsSavingMicrosoft(false);
      }
    } else {
      // Enable Microsoft 365 SSO
      setIsSavingMicrosoft(true);
      try {
        const res = await fetch(`/api/v1/config/authentication/azure-ad/enable`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("session")}`,
          },
          body: JSON.stringify({
            redirectUri: microsoftRedirectUri,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Microsoft 365 SSO has been enabled");
          setProviderType("");
        } else {
          alert(data.message || "Failed to enable Microsoft 365 SSO");
          setMicrosoftEnabled(false);
        }
      } catch (error) {
        console.error("Failed to enable Microsoft SSO:", error);
        alert("Failed to enable Microsoft 365 SSO. Make sure Graph credentials are configured.");
        setMicrosoftEnabled(false);
      } finally {
        setIsSavingMicrosoft(false);
      }
    }
  }

  useEffect(() => {
    checkState();
  }, []);

  useEffect(() => {
    setUri();
    if (providerType === "microsoft-365") {
      checkMicrosoftStatus();
    }
  }, [providerType]);

  return (
    <main className="flex-1">
      <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
        <div className="pt-10 pb-16">
          <div className="px-4 sm:px-6 md:px-0">
            <h1 className="text-3xl font-extrabold text-foreground ">
              Authentifizierungs-Einstellungen
            </h1>
          </div>
          <div className="px-4 sm:px-6 md:px-0 my-4">
            {enabled ? (
              <div className="flex justify-center mt-16">
                <Card className={cn("w-[380px]")}>
                  <CardHeader>
                    <CardTitle className="capitalize">
                      {provider} Einstellungen
                    </CardTitle>
                    <CardDescription>
                      Verwalten Sie Ihre {provider} Konfiguration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4"></CardContent>
                  <CardFooter>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full bg-red-500">
                          <Check className="mr-2 h-4 w-4" /> Löschen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Sind Sie absolut sicher?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Diese Aktion kann nicht rückgängig gemacht werden. Die Authentifizierungskonfiguration wird dauerhaft gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteData()}>
                            Fortfahren
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              </div>
            ) : (
              <div>
                <div className="mb-6 space-y-3">
                  {[
                    { value: "oidc", label: "OIDC", disabled: false },
                    { value: "microsoft-365", label: "Microsoft 365 / Azure AD SSO", disabled: false },
                    { value: "oauth", label: "OAuth", disabled: true },
                    { value: "saml", label: "SAML – demnächst verfügbar", disabled: true },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      disabled={method.disabled}
                      onClick={() =>
                        setProviderType(
                          providerType === method.value ? "" : method.value
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                        providerType === method.value
                          ? "border-green-600 bg-green-50 text-green-800"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                        method.disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <span
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                          providerType === method.value
                            ? "bg-green-600"
                            : "bg-gray-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            providerType === method.value
                              ? "translate-x-6"
                              : "translate-x-1"
                          )}
                        />
                      </span>
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
                {providerType && (
                  <div className="space-y-4 mt-4">
                    <h2 className="text-base font-semibold leading-7 text-gray-900">
                      {providerType.toUpperCase()} Settings
                    </h2>
                    {providerType === "oidc" && (
                      <>
                        <div>
                          <label
                            htmlFor="issuer"
                            className="block text-sm font-medium leading-6 text-gray-900"
                          >
                            Issuer
                          </label>
                          <input
                            type="text"
                            id="issuer"
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            onChange={(e) => setIssuer(e.target.value)}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="clientId"
                            className="block text-sm font-medium leading-6 text-gray-900"
                          >
                            Client Id
                          </label>
                          <input
                            type="text"
                            id="clientId"
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            onChange={(e) => setClientId(e.target.value)}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="redirectUri"
                            className="block text-sm font-medium leading-6 text-gray-900"
                          >
                            Redirect URI
                          </label>
                          <input
                            type="text"
                            id="redirectUri"
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            onChange={(e) => setRedirectUri(e.target.value)}
                            value={redirectUri}
                          />
                        </div>
                      </>
                    )}
                    {providerType === "oauth" && (
                      <>
                        <div className="space-y-4 mt-2">
                          <div>
                            <label
                              htmlFor="clientId"
                              className="block text-sm font-medium leading-6 text-gray-900"
                            >
                              Client Id
                            </label>
                            <input
                              type="text"
                              id="clientId"
                              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                              onChange={(e) => setClientId(e.target.value)}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="clientId"
                              className="block text-sm font-medium leading-6 text-gray-900"
                            >
                              Client Secret
                            </label>
                            <input
                              type="text"
                              id="clientId"
                              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                              onChange={(e) => setClientId(e.target.value)}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="clientId"
                              className="block text-sm font-medium leading-6 text-gray-900"
                            >
                              Redirect URI
                            </label>
                            <input
                              type="text"
                              id="clientId"
                              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                              onChange={(e) => setClientId(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {providerType === "microsoft-365" && (
                      <>
                        <div className="space-y-4 mt-2 bg-gray-50 p-6 rounded-lg border border-gray-200">
                          <div className="mb-6">
                            <h3 className="text-base font-semibold text-gray-900 mb-2">
                              Microsoft 365 / Azure AD SSO Status
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                              {microsoftEnabled ? (
                                <span className="text-green-700 font-medium">✓ Microsoft 365 SSO is currently ENABLED</span>
                              ) : (
                                <span className="text-orange-700 font-medium">⚠ Microsoft 365 SSO is currently DISABLED</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              Before enabling, make sure you have configured Microsoft Graph credentials in the "Microsoft 365" settings section.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={microsoftEnabled}
                                onChange={(e) => setMicrosoftEnabled(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              <span className="text-sm font-medium text-gray-900">
                                Enable Microsoft 365 / Azure AD Login
                              </span>
                            </label>
                          </div>

                          <div>
                            <label
                              htmlFor="microsoftRedirectUri"
                              className="block text-sm font-medium leading-6 text-gray-900 mb-2"
                            >
                              Redirect URI
                            </label>
                            <input
                              type="text"
                              id="microsoftRedirectUri"
                              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                              onChange={(e) => setMicrosoftRedirectUri(e.target.value)}
                              value={microsoftRedirectUri}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              Use this URI when configuring your Azure AD application. It must match exactly in the Azure portal.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {/* Example for SAML */}
                    {/* {providerType === "saml" && (
                  <>
                    <div>
                      <label htmlFor="samlField" className="block text-sm font-medium leading-6 text-gray-900">
                        SAML Field
                      </label>
                      <input
                        type="text"
                        id="samlField"
                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        onChange={(e) => setSomeSamlField(e.target.value)} // Adjust as needed
                      />
                    </div>
                  </>
                )} */}
                    {/* Save button */}
                    <div className="mt-6 flex items-center justify-end gap-x-6">
                      <button
                        type="submit"
                        onClick={() => postData()}
                        disabled={isSavingMicrosoft && providerType === "microsoft-365"}
                        className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingMicrosoft && providerType === "microsoft-365" ? "Speichern..." : "Speichern"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
