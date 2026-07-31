"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { RefreshCw, Users, Building2, Plug, Database, Shield, Activity, ArrowLeft } from "lucide-react";

interface SystemStats {
  organizations: number;
  users: number;
  members: number;
  services: number;
  content_items: number;
  plugins: number;
  vault_operations: number;
}

interface HealthStatus {
  database: string;
  redis: string;
  pgaudit: string;
  status: string;
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  created_at: string | null;
  org_count: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, fetchUser } = useStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) { router.push("/login"); return; }
      await fetchUser();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!user || (user.role !== "owner" && user.role !== "admin")) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [s, h, u] = await Promise.all([
        api.admin.getStats(),
        api.admin.getHealth(),
        api.admin.getUsers(),
      ]);
      setStats(s);
      setHealth(h);
      setUsers(u);
    } catch (e: any) {
      setError(e.message || "Failed to load admin data");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-gray-400 mt-2">Admin role required</p>
          <button onClick={() => router.push("/tree")} className="mt-4 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
            Back to Tree
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">System Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={loadData} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">{error}</div>}

        {/* System Health */}
        {health && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" /> System Health
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Database", value: health.database, ok: health.database === "ok" },
                { label: "Redis", value: health.redis, ok: health.redis === "ok" },
                { label: "pgAudit", value: health.pgaudit, ok: health.pgaudit === "installed" },
                { label: "Status", value: health.status, ok: health.status === "healthy" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400">{item.label}</div>
                  <div className={`text-lg font-semibold ${item.ok ? "text-green-400" : "text-yellow-400"}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" /> System Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Organizations", value: stats.organizations, icon: Building2 },
                { label: "Users", value: stats.users, icon: Users },
                { label: "Services", value: stats.services, icon: Plug },
                { label: "Content Items", value: stats.content_items, icon: Database },
                { label: "Plugins", value: stats.plugins, icon: Plug },
                { label: "Vault Operations", value: stats.vault_operations, icon: Shield },
              ].map((item) => (
                <div key={item.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                    <item.icon className="w-4 h-4" /> {item.label}
                  </div>
                  <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {users.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" /> Users ({users.length})
            </h2>
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Orgs</th>
                    <th className="text-left p-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.name}</td>
                      <td className="p-3">{u.org_count}</td>
                      <td className="p-3 text-gray-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="flex items-center gap-2 text-white">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <p>Loading...</p>
      </div>
    </main>
  );
}
