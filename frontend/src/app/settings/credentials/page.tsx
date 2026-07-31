"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Key, RefreshCw, Eye, EyeOff, Shield } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function CredentialsPage() {
  const router = useRouter();
  const { services } = useStore();
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchCredentials();
  }, [services]);

  const fetchCredentials = async () => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    const orgId = useStore.getState().org?.id;
    if (!token || !orgId) return;

    const creds: Record<string, any> = {};
    for (const service of services) {
      try {
        const res = await fetch(`${API_BASE}/orgs/${orgId}/services/${service.id}/credentials`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          creds[service.id] = await res.json();
        }
      } catch {}
    }
    setCredentials(creds);
    setLoading(false);
  };

  const maskToken = (token: string) => {
    if (!token) return "••••••••";
    return token.substring(0, 8) + "••••" + token.substring(token.length - 4);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Key className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Credentials</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">Security Notice</h2>
          </div>
          <p className="text-sm text-gray-400">
            Credentials are stored locally in an encrypted vault. They are never sent to external servers.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : services.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <p className="text-gray-400">No services connected. Add a service to manage credentials.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => {
              const cred = credentials[service.id];
              const isVisible = showTokens[service.id];
              return (
                <div key={service.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{service.display_name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      cred ? "bg-green-900/50 text-green-400" : "bg-gray-700 text-gray-400"
                    }`}>
                      {cred ? "Stored" : "Not Stored"}
                    </span>
                  </div>
                  {cred && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Vault Path</span>
                        <span className="font-mono text-xs text-gray-300">{cred.vault_path || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Key Version</span>
                        <span className="text-gray-300">{cred.key_version || 1}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Token</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-300">
                            {isVisible ? (cred.access_token || "N/A") : maskToken(cred.access_token || "")}
                          </span>
                          <button
                            onClick={() => setShowTokens(prev => ({ ...prev, [service.id]: !prev[service.id] }))}
                            className="p-1 hover:bg-gray-700 rounded"
                          >
                            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
