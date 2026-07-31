"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Bell, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

const METRICS = [
  { value: "error_rate", label: "Error Rate" },
  { value: "sync_failures", label: "Sync Failures" },
  { value: "sentiment_negative", label: "Negative Sentiment" },
  { value: "content_volume", label: "Content Volume" },
];

export default function AlertingPage() {
  const router = useRouter();
  const { org } = useStore();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("error_rate");
  const [threshold, setThreshold] = useState("10");
  const [enabled, setEnabled] = useState(true);
  const [ruleName, setRuleName] = useState("");
  const [creating, setCreating] = useState(false);

  const orgId = org?.id;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    if (orgId) fetchRules();
  }, [orgId]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await api.alerting.listRules(orgId!);
      setRules(data);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!ruleName.trim() || !threshold) return;
    setCreating(true);
    try {
      await api.alerting.createRule(orgId!, {
        name: ruleName.trim(),
        metric,
        threshold: parseFloat(threshold),
        enabled,
      });
      setRuleName("");
      setThreshold("10");
      await fetchRules();
    } catch {}
    setCreating(false);
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await api.alerting.deleteRule(orgId!, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {}
  };

  const toggleEnabled = async (rule: any) => {
    try {
      await api.alerting.updateRule(orgId!, rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
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
            <Bell className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Alerting Rules</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Create Rule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. High error rate alert"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Threshold</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setEnabled(!enabled)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {enabled ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
                </button>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !ruleName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? "Creating..." : "Create Rule"}
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="p-5 border-b border-gray-700">
              <h2 className="text-lg font-semibold">Rules</h2>
            </div>
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : rules.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No alerting rules configured.</div>
            ) : (
              <div className="divide-y divide-gray-700">
                {rules.map((rule) => (
                  <div key={rule.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{rule.name}</p>
                      <p className="text-sm text-gray-400">
                        {METRICS.find((m) => m.value === rule.metric)?.label || rule.metric}
                        {" "}above {" "}{rule.threshold}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <button
                        onClick={() => toggleEnabled(rule)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title={rule.enabled ? "Disable" : "Enable"}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1 hover:bg-gray-700 rounded text-red-400 hover:text-red-300 transition-colors"
                        title="Delete rule"
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
    </main>
  );
}
