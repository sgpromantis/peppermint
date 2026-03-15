import { Button } from "@/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { toast } from "@/shadcn/hooks/use-toast";
import { getCookie } from "cookies-next";
import { Copy, Key, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ApiKey {
  id: string;
  createdAt: string;
  expires: string;
  user: { id: string; name: string; email: string };
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function fetchKeys() {
    const res = await fetch("/api/v1/auth/api-keys", {
      headers: { Authorization: `Bearer ${getCookie("session")}` },
    }).then((r) => r.json());
    if (res.success) setKeys(res.keys);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function createKey() {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/auth/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCookie("session")}`,
        },
      }).then((r) => r.json());

      if (res.success) {
        setNewToken(res.token);
        fetchKeys();
        toast({ title: "API-Key erstellt" });
      }
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/v1/auth/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getCookie("session")}` },
    }).then((r) => r.json());

    if (res.success) {
      fetchKeys();
      toast({ title: "API-Key widerrufen" });
    }
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      toast({ title: "In Zwischenablage kopiert" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API-Keys
          </CardTitle>
          <CardDescription>
            Erstellen und verwalten Sie API-Keys für den programmatischen
            Zugriff. Keys sind 1 Jahr gültig.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={createKey} disabled={creating} className="w-fit">
            Neuen API-Key erstellen
          </Button>

          {newToken && (
            <div className="rounded-md border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Kopieren Sie diesen Key jetzt — er wird nicht erneut angezeigt.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white dark:bg-black p-2 text-xs break-all border">
                  {newToken}
                </code>
                <Button variant="outline" size="sm" onClick={copyToken}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine API-Keys vorhanden.
            </p>
          ) : (
            <div className="divide-y">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {k.user.name} ({k.user.email})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Erstellt: {new Date(k.createdAt).toLocaleDateString("de")}{" "}
                      — Gültig bis:{" "}
                      {new Date(k.expires).toLocaleDateString("de")}
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => revokeKey(k.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Widerrufen
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
