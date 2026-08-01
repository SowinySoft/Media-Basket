"use client";

import { decodeJwtPayload } from "../../../../lib/jwt";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, FileText, RefreshCw, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CONNECTOR_ICONS: Record<string, string> = {
  youtube: "📺", reddit: "🔷", whatsapp: "💬", telegram: "✈️",
  instagram: "📸", twitter: "🐦", facebook: "📘", linkedin: "💼",
  tiktok: "🎵", discord: "🎮", slack: "💼", mastodon: "🐘",
  pinterest: "📌", snapchat: "👻", bluesky: "🦋",
};

export default function ServiceContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [service, setService] = useState<any>(null);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    let orgId: string;
    try {
      const payload = decodeJwtPayload(token);
      orgId = payload.org_id;
    } catch {
      router.push("/login");
      return;
    }

    try {
      const [svcRes, contentRes] = await Promise.all([
        fetch(`${API_BASE}/orgs/${orgId}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/orgs/${orgId}/content?service_id=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (svcRes.ok) {
        const svcs = await svcRes.json();
        setService(svcs.find((s: any) => s.id === id));
      }
      if (contentRes.ok) setContent(await contentRes.json());
    } catch {}
    setLoading(false);
  };

  const filtered = filter === "all" ? content : content.filter((c) => c.content_type === filter);
  const types = Array.from(new Set(content.map((c) => c.content_type)));

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-2xl">{CONNECTOR_ICONS[service?.connector_type] || "🔗"}</span>
            <div>
              <h1 className="text-2xl font-bold">{service?.display_name || "Service"}</h1>
              <p className="text-sm text-gray-400">Content Browser</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {types.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              All ({content.length})
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap capitalize ${filter === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >
                {t} ({content.filter((c) => c.content_type === t).length})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No content found. Sync this service to load content.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push("/tree")}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 cursor-pointer transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 capitalize">
                        {item.content_type}
                      </span>
                      {item.metadata?.flagged && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400">Flagged</span>
                      )}
                      {item.metadata?.sentiment && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.metadata.sentiment === "positive" ? "bg-green-900/50 text-green-400" :
                          item.metadata.sentiment === "negative" ? "bg-red-900/50 text-red-400" :
                          "bg-gray-700 text-gray-400"
                        }`}>
                          {item.metadata.sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {item.payload?.title || item.payload?.body || item.payload?.text || "No title"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.ingested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
