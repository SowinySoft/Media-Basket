"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Plus, Trash2, AlertTriangle, TrendingDown, Hash, Activity } from "lucide-react";

interface AlertItem {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface Props {
  orgId: string;
}

const ALERT_TYPES = [
  { value: "spike_negative", label: "Negative Spike", icon: TrendingDown, desc: "Alert when negative sentiment spikes" },
  { value: "sentiment_drop", label: "Sentiment Drop", icon: AlertTriangle, desc: "Alert when average sentiment drops below threshold" },
  { value: "keyword_match", label: "Keyword Match", icon: Hash, desc: "Alert when specific keywords are detected" },
  { value: "volume_spike", label: "Volume Spike", icon: Activity, desc: "Alert when content volume exceeds threshold" },
];

export default function SentimentAlerts({ orgId }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("spike_negative");
  const [threshold, setThreshold] = useState("0.7");
  const [keywords, setKeywords] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, [orgId]);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAlerts(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    const config: Record<string, any> = {};
    if (newType === "spike_negative" || newType === "sentiment_drop") {
      config.threshold = parseFloat(threshold);
    }
    if (newType === "keyword_match") {
      config.keywords = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/alerts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, config }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName("");
        setKeywords("");
        await fetchAlerts();
      }
    } catch {}
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/alerts/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchAlerts();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this alert?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/alerts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAlerts();
    } catch {}
  };

  const typeConfig = ALERT_TYPES.find((t) => t.value === newType);

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Sentiment Alerts</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 space-y-3">
          <input
            type="text"
            placeholder="Alert name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none"
          >
            {ALERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {(newType === "spike_negative" || newType === "sentiment_drop") && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Threshold (0-1)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {newType === "keyword_match" && (
            <input
              type="text"
              placeholder="Keywords (comma separated)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : alerts.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No alerts configured</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {alerts.map((a) => {
              const typeInfo = ALERT_TYPES.find((t) => t.value === a.type);
              const Icon = typeInfo?.icon || Bell;
              return (
                <div key={a.id} className="px-4 py-3 hover:bg-gray-750">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-white">{a.name}</p>
                        <p className="text-xs text-gray-400">
                          {typeInfo?.label || a.type}
                          {a.config?.threshold && ` — threshold: ${a.config.threshold}`}
                          {a.config?.keywords && ` — ${a.config.keywords.length} keywords`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(a.id, !a.enabled)}
                        className={a.enabled ? "text-green-400" : "text-gray-500"}
                        title={a.enabled ? "Disable" : "Enable"}
                      >
                        {a.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
