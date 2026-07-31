"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  FileText,
  Link2,
  Bell,
  RefreshCw,
  Plus,
  Settings,
  ExternalLink,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
} from "lucide-react";

const CONNECTOR_ICONS: Record<string, string> = {
  youtube: "📺", reddit: "🔷", whatsapp: "💬", telegram: "✈️",
  instagram: "📸", twitter: "🐦", facebook: "📘", linkedin: "💼",
  tiktok: "🎵", discord: "🎮", slack: "💼", mastodon: "🐘",
  pinterest: "📌", snapchat: "👻", bluesky: "🦋",
};

const CONNECTOR_COLORS: Record<string, string> = {
  youtube: "bg-red-900/50 text-red-400",
  reddit: "bg-orange-900/50 text-orange-400",
  whatsapp: "bg-green-900/50 text-green-400",
  telegram: "bg-blue-900/50 text-blue-400",
  instagram: "bg-pink-900/50 text-pink-400",
  twitter: "bg-sky-900/50 text-sky-400",
  facebook: "bg-blue-900/50 text-blue-400",
  linkedin: "bg-blue-900/50 text-blue-400",
  tiktok: "bg-purple-900/50 text-purple-400",
  discord: "bg-indigo-900/50 text-indigo-400",
  slack: "bg-yellow-900/50 text-yellow-400",
  mastodon: "bg-teal-900/50 text-teal-400",
  pinterest: "bg-red-900/50 text-red-400",
  snapchat: "bg-yellow-900/50 text-yellow-400",
  bluesky: "bg-sky-900/50 text-sky-400",
};

interface ContentItem {
  id: string;
  service_instance_id: string;
  content_type: string;
  payload: any;
  ingested_at: string;
  metadata?: {
    sentiment?: string;
    sentiment_score?: number;
  };
}

interface InboxStats {
  total: number;
  unread: number;
  by_type: Record<string, number>;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { org, services, content, fetchUser, fetchServices, fetchContent, syncService } = useStore();
  const [inboxStats, setInboxStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      await fetchUser();
      await fetchServices();
      await fetchContent();
      const me = useStore.getState().org;
      if (me?.id) {
        const stats = await api.inbox.stats(me.id);
        setInboxStats(stats);
      }
    } catch {}
    setLoading(false);
  };

  const orgContent = useStore.getState().content;
  const orgServices = useStore.getState().services;

  const positive = orgContent.filter((c) => c.metadata?.sentiment === "positive").length;
  const negative = orgContent.filter((c) => c.metadata?.sentiment === "negative").length;
  const neutral = orgContent.filter((c) => c.metadata?.sentiment === "neutral" || !c.metadata?.sentiment).length;

  const recentContent = [...orgContent]
    .sort((a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime())
    .slice(0, 10);

  const serviceMap = Object.fromEntries(
    orgServices.map((s) => [s.id, s])
  );

  const handleSync = async (serviceId: string) => {
    setSyncingId(serviceId);
    try {
      await syncService(serviceId);
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <LayoutDashboard className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {org && <span className="text-sm text-gray-400 ml-2">{org.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadDashboard} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-900/50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Total Content</span>
            </div>
            <p className="text-3xl font-bold text-white">{orgContent.length}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-900/50 rounded-lg">
                <Link2 className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Connected Services</span>
            </div>
            <p className="text-3xl font-bold text-white">{orgServices.length}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-900/50 rounded-lg">
                <ThumbsUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Sentiment</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm">
                <ThumbsUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 font-medium">{positive}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-medium">{negative}</span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <Minus className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-400 font-medium">{neutral}</span>
              </span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-900/50 rounded-lg">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">Unread Notifications</span>
            </div>
            <p className="text-3xl font-bold text-white">{inboxStats?.unread ?? 0}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Content */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Content</h2>
              <button
                onClick={() => router.push("/tree")}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                View all <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {recentContent.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
                  <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No content yet. Connect a service to get started.</p>
                </div>
              ) : (
                recentContent.map((item) => {
                  const service = serviceMap[item.service_instance_id];
                  const connectorType = service?.connector_type || "unknown";
                  const sentiment = item.metadata?.sentiment;
                  return (
                    <div
                      key={item.id}
                      className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition cursor-pointer"
                      onClick={() => router.push("/tree")}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">
                          {CONNECTOR_ICONS[connectorType] || "🔗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CONNECTOR_COLORS[connectorType] || "bg-gray-700 text-gray-400"}`}>
                              {connectorType}
                            </span>
                            {sentiment && (
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                sentiment === "positive" ? "bg-green-900/50 text-green-400" :
                                sentiment === "negative" ? "bg-red-900/50 text-red-400" :
                                "bg-gray-700 text-gray-400"
                              }`}>
                                {sentiment}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">{timeAgo(item.ingested_at)}</span>
                          </div>
                          <p className="text-sm text-gray-300 truncate">
                            {item.payload?.title || item.payload?.body || item.payload?.text || "No content"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Service Health + Quick Actions */}
          <div className="space-y-6">
            {/* Service Health */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Service Health</h2>
              <div className="space-y-3">
                {orgServices.length === 0 ? (
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                    <Link2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 mb-3">No services connected</p>
                    <button
                      onClick={() => router.push("/tree")}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Add your first service
                    </button>
                  </div>
                ) : (
                  orgServices.map((service) => (
                    <div key={service.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">{CONNECTOR_ICONS[service.connector_type] || "🔗"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{service.display_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{service.connector_type}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          service.status === "active" ? "bg-green-900/50 text-green-400" :
                          service.status === "expired" ? "bg-yellow-900/50 text-yellow-400" :
                          "bg-red-900/50 text-red-400"
                        }`}>
                          {service.status === "active" ? "connected" : service.status}
                        </span>
                      </div>
                      {service.last_synced_at && (
                        <p className="text-xs text-gray-500 mb-2">
                          Synced {timeAgo(service.last_synced_at)}
                        </p>
                      )}
                      <button
                        onClick={() => handleSync(service.id)}
                        disabled={syncingId === service.id}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition disabled:opacity-50"
                      >
                        {syncingId === service.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {syncingId === service.id ? "Syncing..." : "Sync"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => router.push("/tree")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Service
                </button>
                <button
                  onClick={() => router.push("/tree")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition text-sm font-medium"
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  View All Content
                </button>
                <button
                  onClick={() => router.push("/settings")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition text-sm font-medium"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
