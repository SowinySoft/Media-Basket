"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Puzzle, ExternalLink, Power, Trash2, PowerOff } from "lucide-react";

const CONNECTORS = [
  { name: "YouTube", type: "youtube", icon: "📺", tier: "full", status: "built-in" },
  { name: "Reddit", type: "reddit", icon: "🔷", tier: "full", status: "built-in" },
  { name: "WhatsApp Business", type: "whatsapp", icon: "💬", tier: "full", status: "built-in" },
  { name: "Telegram", type: "telegram", icon: "✈️", tier: "full", status: "built-in" },
  { name: "Instagram", type: "instagram", icon: "📸", tier: "full", status: "built-in" },
  { name: "Twitter / X", type: "twitter", icon: "🐦", tier: "full", status: "built-in" },
  { name: "Facebook", type: "facebook", icon: "📘", tier: "full", status: "built-in" },
  { name: "LinkedIn", type: "linkedin", icon: "💼", tier: "lightweight", status: "built-in" },
  { name: "TikTok", type: "tiktok", icon: "🎵", tier: "full", status: "built-in" },
  { name: "Discord", type: "discord", icon: "🎮", tier: "full", status: "built-in" },
  { name: "Slack", type: "slack", icon: "💼", tier: "full", status: "built-in" },
  { name: "Mastodon", type: "mastodon", icon: "🐘", tier: "full", status: "built-in" },
  { name: "Pinterest", type: "pinterest", icon: "📌", tier: "lightweight", status: "built-in" },
  { name: "Snapchat", type: "snapchat", icon: "👻", tier: "lightweight", status: "built-in" },
  { name: "Bluesky", type: "bluesky", icon: "🦋", tier: "full", status: "built-in" },
];

export default function PluginsPage() {
  const router = useRouter();
  const { org } = useStore();
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);

  const orgId = org?.id;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    if (orgId) fetchPlugins();
  }, [orgId]);

  const fetchPlugins = async () => {
    setLoadingPlugins(true);
    try {
      const data = await api.plugins.list(orgId!);
      setPlugins(data);
    } catch {}
    setLoadingPlugins(false);
  };

  const handleActivate = async (pluginId: string) => {
    try {
      await api.plugins.activate(orgId!, pluginId);
      setPlugins((prev) => prev.map((p) => p.id === pluginId ? { ...p, active: true } : p));
    } catch {}
  };

  const handleDeactivate = async (pluginId: string) => {
    try {
      await api.plugins.deactivate(orgId!, pluginId);
      setPlugins((prev) => prev.map((p) => p.id === pluginId ? { ...p, active: false } : p));
    } catch {}
  };

  const handleUninstall = async (pluginId: string) => {
    try {
      await api.plugins.uninstall(orgId!, pluginId);
      setPlugins((prev) => prev.filter((p) => p.id !== pluginId));
    } catch {}
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Puzzle className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Connectors & Plugins</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Built-in Connectors</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONNECTORS.map((c) => (
                <div key={c.type} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{c.tier}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Installed Plugins</h2>
              <a
                href="/marketplace"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                Browse more plugins <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700">
              {loadingPlugins ? (
                <div className="p-6 text-center text-gray-400">Loading plugins...</div>
              ) : plugins.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  No plugins installed yet.
                  <a href="/marketplace" className="block mt-2 text-blue-400 hover:text-blue-300">
                    Browse the marketplace
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {plugins.map((plugin) => (
                    <div key={plugin.id} className="px-5 py-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{plugin.name || plugin.plugin_name}</p>
                        <p className="text-sm text-gray-400 truncate">{plugin.description || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {plugin.active ? (
                          <button
                            onClick={() => handleDeactivate(plugin.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-900/30 border border-yellow-700 text-yellow-400 rounded-lg text-xs hover:bg-yellow-900/50 transition-colors"
                            title="Deactivate"
                          >
                            <PowerOff className="w-3 h-3" />
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(plugin.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-900/30 border border-green-700 text-green-400 rounded-lg text-xs hover:bg-green-900/50 transition-colors"
                            title="Activate"
                          >
                            <Power className="w-3 h-3" />
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          className="p-1.5 text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Uninstall"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
