import { setCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function MicrosoftCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleCallback() {
    // Wait for router query params to be available
    if (!router.isReady) return;

    const { code, state, error: oauthError, error_description } = router.query;

    if (oauthError) {
      console.error("Azure AD error:", oauthError, error_description);
      setError(String(error_description || oauthError));
      setTimeout(() => {
        router.push("/auth/login?error=sso_failed");
      }, 3000);
      return;
    }

    if (!code || !state) {
      // Params not yet loaded, wait
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/auth/microsoft/callback?code=${encodeURIComponent(String(code))}&state=${encodeURIComponent(String(state))}`
      );
      const data = await res.json();

      if (data.success && data.token) {
        setCookie("session", data.token, { maxAge: 60 * 6 * 24 });
        router.push("/");
      } else {
        console.error("Microsoft login failed:", data.error);
        setError(data.error || "Anmeldung fehlgeschlagen");
        setTimeout(() => {
          router.push("/auth/login?error=account_not_found");
        }, 3000);
      }
    } catch (err: any) {
      console.error("Microsoft callback error:", err);
      setError(err.message || "Verbindungsfehler");
      setTimeout(() => {
        router.push("/auth/login?error=sso_failed");
      }, 3000);
    }
  }

  useEffect(() => {
    handleCallback();
  }, [router.isReady, router.query]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-2">Anmeldung fehlgeschlagen</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-400 text-xs mt-2">Weiterleitung zur Anmeldeseite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Microsoft Anmeldung wird verarbeitet...</p>
      </div>
    </div>
  );
}
