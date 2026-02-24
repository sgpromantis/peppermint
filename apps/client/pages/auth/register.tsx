import { toast } from "@/shadcn/hooks/use-toast";
import { useRouter } from "next/router";
import { useState } from "react";
import Link from "next/link";

export default function Login({}) {
  const router = useRouter();

  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [language, setLanguage] = useState("de");
  const [status, setStatus] = useState("idle");

  async function postData() {
    if (password === passwordConfirm && validateEmail(email)) {
      setStatus("loading");

      const response = await fetch("/api/v1/auth/user/register/external", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          passwordConfirm,
          language,
        }),
      }).then((res) => res.json());

      if (response.success) {
        setStatus("idle");
        router.push("/auth/login");
      } else {
        setStatus("idle");
        toast({
          variant: "destructive",
          title: "Fehler",
          description: response.message || "Registrierung fehlgeschlagen",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Passwörter stimmen nicht überein oder E-Mail ist ungültig",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Neues Konto erstellen
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {status === "loading" ? (
          <div className="text-center mr-4">{/* <Loader size={32} /> */}</div>
        ) : (
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
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
                    value={password}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Passwort bestätigen
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>

                <label className="block text-sm font-medium text-gray-700">
                  Sprache
                </label>
                <div className="mt-1 rounded-md shadow-sm flex">
                  <select
                    id="language"
                    name="language"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                    <option value="se">Schwedisch</option>
                    <option value="es">Spanisch</option>
                    <option value="no">Norwegisch</option>
                    <option value="fr">Französisch</option>
                    <option value="da">Dänisch</option>
                    <option value="pt">Portugiesisch</option>
                    <option value="it">Italienisch</option>
                    <option value="he">Hebräisch</option>
                    <option value="tr">Türkisch</option>
                    <option value="hu">Ungarisch</option>
                    <option value="th">Thailändisch</option>
                    <option value="zh-CN">Vereinfachtes Chinesisch</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  onClick={postData}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Konto erstellen
                </button>

                <p className="mt-2 text-xs text-gray-600 text-center">
                  Hinweis: Die Registrierung erfordert die Genehmigung des Administrators
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center flex flex-col space-y-2">
          <Link href="/auth/login" className="text-green-600 hover:text-green-700">
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
