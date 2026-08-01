"use client";

import { decodeJwtPayload } from "../../../../lib/jwt";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function ServiceAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [service, setService] = useState<any>(null);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Compute analytics
  const totalItems = content.length;
  const byType = content.reduce((acc: Record<string, number>, c) => {
    acc[c.content_type] = (acc[c.content_type] || 0) + 1;
    return acc;
  }, {});
  const flagged = content.filter((c) => c.metadata?.flagged).length;
  const sentimentBreakdown = content.reduce((acc: Record<string, number>, c) => {
    const s = c.metadata?.sentiment || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const avgEngagement = content.reduce((sum, c) => {
    const likes = c.payload?.metrics?.likes || 0;
    const views = c.payload?.metrics?.views || 0;
    return sum + likes + views;
  }, 0) / (totalItems || 1);

  const topContent = [...content]
    .sort((a, b) => {
      const aEng = (a.payload?.metrics?.likes || 0) + (a.payload?.metrics?.views || 0);
      const bEng = (b.payload?.metrics?.likes || 0) + (b.payload?.metrics?.views || 0);
      return bEng - aEng;
    })
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">{service?.display_name || "Service"}</h1>
              <p className="text-sm text-gray-400">Analytics</p>
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
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-blue-400">{totalItems}</p>
                <p className="text-xs text-gray-400">Total Items</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-red-400">{flagged}</p>
                <p className="text-xs text-gray-400">Flagged</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {sentimentBreakdown.positive || 0}
                </p>
                <p className="text-xs text-gray-400">Positive</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                <p className="text-2xl font-bold text-yellow-400">{Math.round(avgEngagement)}</p>
                <p className="text-xs text-gray-400">Avg Engagement</p>
              </div>
            </div>

            {/* Content by Type */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="font-semibold mb-3">Content by Type</h2>
              <div className="space-y-2">
                {Object.entries(byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 capitalize">{type}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${((count as number) / totalItems) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-300 w-8 text-right">{count as number}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment Breakdown */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="font-semibold mb-3">Sentiment Analysis</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(sentimentBreakdown).map(([sentiment, count]) => (
                  <div key={sentiment} className="text-center p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-lg font-bold capitalize" style={{
                      color: sentiment === "positive" ? "#4ade80" : sentiment === "negative" ? "#f87171" : "#9ca3af"
                    }}>
                      {count as number}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{sentiment}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Content */}
            {topContent.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="font-semibold mb-3">Top Content</h2>
                <div className="space-y-2">
                  {topContent.map((item, i) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg">
                      <span className="text-lg font-bold text-gray-500 w-6">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">
                          {item.payload?.title || item.payload?.body || item.payload?.text || "No title"}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{item.content_type}</p>
                      </div>
                      <span className="text-sm text-gray-400">
                        {item.payload?.metrics?.likes || 0} likes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
