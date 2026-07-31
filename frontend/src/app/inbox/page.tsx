"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Inbox, RefreshCw, Bell, MessageSquare, AlertTriangle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CONNECTOR_ICONS: Record<string, string> = {
  youtube: "📺", reddit: "🔷", whatsapp: "💬", telegram: "✈️",
  instagram: "📸", twitter: "🐦", facebook: "📘", linkedin: "💼",
  tiktok: "🎵", discord: "🎮", slack: "💼", mastodon: "🐘",
  pinterest: "📌", snapchat: "👻", bluesky: "🦋",
};

interface InboxItem {
  id: string;
  service_id: string;
  service_name: string;
  connector_type: string;
  content_type: string;
  payload: any;
  ingested_at: string;
  flagged: boolean;
  sentiment?: string;
}

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flagged" | "unread">("all");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    let orgId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      orgId = payload.org_id;
    } catch { router.push("/login"); return; }

    try {
      const [servicesRes, contentRes] = await Promise.all([
        fetch(`${API_BASE}/orgs/${orgId}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/orgs/${orgId}/content`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (servicesRes.ok && contentRes.ok) {
        const services = await servicesRes.json();
        const content = await contentRes.json();
        const serviceMap = Object.fromEntries(services.map((s: any) => [s.id, s]));

        const inboxItems: InboxItem[] = content.map((c: any) => ({
          id: c.id,
          service_id: c.service_instance_id,
          service_name: serviceMap[c.service_instance_id]?.display_name || "Unknown",
          connector_type: serviceMap[c.service_instance_id]?.connector_type || "unknown",
          content_type: c.content_type,
          payload: c.payload,
          ingested_at: c.ingested_at,
          flagged: c.metadata?.flagged || false,
          sentiment: c.metadata?.sentiment,
        }));

        inboxItems.sort((a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime());
        setItems(inboxItems);
      }
    } catch {}
    setLoading(false);
  };

  const filtered = filter === "all" ? items :
    filter === "flagged" ? items.filter((i) => i.flagged) :
    items;

  const flaggedCount = items.filter((i) => i.flagged).length;

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Inbox className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Unified Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchInbox} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-blue-400">{items.length}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-red-400">{flaggedCount}</p>
            <p className="text-xs text-gray-400">Flagged</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-2xl font-bold text-green-400">{items.length - flaggedCount}</p>
            <p className="text-xs text-gray-400">Clean</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "flagged", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${filter === f ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              {f === "flagged" && <AlertTriangle className="w-4 h-4 inline mr-1" />}
              {f === "unread" && <Bell className="w-4 h-4 inline mr-1" />}
              {f} {f === "flagged" && flaggedCount > 0 ? `(${flaggedCount})` : ""}
            </button>
          ))}
        </div>

        {/* Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <Inbox className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Your inbox is empty.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`bg-gray-800 rounded-xl p-4 border cursor-pointer transition hover:border-gray-600 ${
                  item.flagged ? "border-red-900/50" : "border-gray-700"
                }`}
                onClick={() => router.push("/tree")}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{CONNECTOR_ICONS[item.connector_type] || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{item.service_name}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400 capitalize">
                        {item.content_type}
                      </span>
                      {item.flagged && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400">Flagged</span>
                      )}
                      {item.sentiment && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.sentiment === "positive" ? "bg-green-900/50 text-green-400" :
                          item.sentiment === "negative" ? "bg-red-900/50 text-red-400" :
                          "bg-gray-700 text-gray-400"
                        }`}>
                          {item.sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {item.payload?.title || item.payload?.body || item.payload?.text || "No content"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.ingested_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
