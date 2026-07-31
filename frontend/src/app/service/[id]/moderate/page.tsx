"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Shield, RefreshCw, Check, X, Flag, MessageSquare } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function ServiceModeratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [service, setService] = useState<any>(null);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const orgId = payload.org_id;

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

  const handleModerate = async (contentId: string, action: string) => {
    setActionLoading(contentId);
    const token = localStorage.getItem("access_token");
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const orgId = payload.org_id;

    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/moderation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content_item_id: contentId, action }),
      });
      if (res.ok) {
        setContent((prev) => prev.filter((c) => c.id !== contentId));
      }
    } catch {}
    setActionLoading(null);
  };

  const flagged = content.filter((c) => c.metadata?.flagged);
  const recent = content.filter((c) => !c.metadata?.flagged).slice(0, 20);

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Shield className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">{service?.display_name || "Service"}</h1>
              <p className="text-sm text-gray-400">Moderation Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {flagged.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-red-400" />
                  Flagged Content ({flagged.length})
                </h2>
                <div className="space-y-3">
                  {flagged.map((item) => (
                    <div key={item.id} className="bg-gray-800 rounded-xl p-4 border border-red-900/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-400">Flagged</span>
                            {item.metadata?.flag_reasons?.map((r: string) => (
                              <span key={r} className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">{r}</span>
                            ))}
                          </div>
                          <p className="text-sm text-gray-300">
                            {item.payload?.title || item.payload?.body || item.payload?.text || "No content"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleModerate(item.id, "approve")}
                            disabled={actionLoading === item.id}
                            className="p-2 bg-green-900/50 text-green-400 rounded-lg hover:bg-green-900/70"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleModerate(item.id, "delete")}
                            disabled={actionLoading === item.id}
                            className="p-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900/70"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                Recent Content ({recent.length})
              </h2>
              {recent.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
                  <p className="text-gray-400">No content to moderate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map((item) => (
                    <div key={item.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 capitalize">
                              {item.content_type}
                            </span>
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
                          <p className="text-sm text-gray-300">
                            {item.payload?.title || item.payload?.body || item.payload?.text || "No content"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleModerate(item.id, "approve")}
                            disabled={actionLoading === item.id}
                            className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-green-900/50 hover:text-green-400"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleModerate(item.id, "flag")}
                            disabled={actionLoading === item.id}
                            className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-yellow-900/50 hover:text-yellow-400"
                            title="Flag"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleModerate(item.id, "delete")}
                            disabled={actionLoading === item.id}
                            className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-red-900/50 hover:text-red-400"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
