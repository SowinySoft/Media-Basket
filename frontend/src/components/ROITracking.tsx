"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, MousePointer, Eye, ShoppingCart, Link } from "lucide-react";

interface ROISummary {
  period_days: number;
  total_events: number;
  by_type: Record<string, number>;
  by_utm_source: Record<string, number>;
  by_campaign: Record<string, number>;
}

interface Props {
  orgId: string;
}

const EVENT_ICONS: Record<string, any> = {
  click: MousePointer,
  view: Eye,
  conversion: ShoppingCart,
};

const EVENT_COLORS: Record<string, string> = {
  click: "text-blue-400 bg-blue-900/30",
  view: "text-green-400 bg-green-900/30",
  conversion: "text-purple-400 bg-purple-900/30",
};

export default function ROITracking({ orgId }: Props) {
  const [summary, setSummary] = useState<ROISummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchSummary();
  }, [orgId, days]);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/roi/summary?days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setSummary(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">ROI Tracking</span>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-gray-400 text-sm text-center">Loading...</p>
        ) : !summary ? (
          <p className="text-gray-500 text-sm text-center">No data available</p>
        ) : (
          <div className="space-y-4">
            {/* Total events */}
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{formatNumber(summary.total_events)}</p>
              <p className="text-xs text-gray-400">Total Events ({summary.period_days} days)</p>
            </div>

            {/* By event type */}
            <div>
              <p className="text-xs text-gray-400 mb-2">By Event Type</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(summary.by_type).map(([type, count]) => {
                  const Icon = EVENT_ICONS[type] || MousePointer;
                  const color = EVENT_COLORS[type] || "text-gray-400 bg-gray-700";
                  return (
                    <div key={type} className={`p-3 rounded-lg ${color}`}>
                      <Icon className="w-4 h-4 mb-1" />
                      <p className="text-lg font-bold">{formatNumber(count)}</p>
                      <p className="text-xs capitalize">{type}s</p>
                    </div>
                  );
                })}
                {Object.keys(summary.by_type).length === 0 && (
                  <p className="col-span-3 text-gray-500 text-xs text-center">No events tracked</p>
                )}
              </div>
            </div>

            {/* By UTM source */}
            {Object.keys(summary.by_utm_source).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">By Source</p>
                <div className="space-y-1">
                  {Object.entries(summary.by_utm_source)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Link className="w-3 h-3 text-gray-400" />
                          <span className="text-white">{source}</span>
                        </div>
                        <span className="text-gray-400">{formatNumber(count)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* By campaign */}
            {Object.keys(summary.by_campaign).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">By Campaign</p>
                <div className="space-y-1">
                  {Object.entries(summary.by_campaign)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([campaign, count]) => (
                      <div key={campaign} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3 h-3 text-gray-400" />
                          <span className="text-white">{campaign}</span>
                        </div>
                        <span className="text-gray-400">{formatNumber(count)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
