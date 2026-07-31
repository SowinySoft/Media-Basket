"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Clock, Play, Trash2, AlertTriangle } from "lucide-react";

export default function RetentionPage() {
  const router = useRouter();
  const { org } = useStore();
  const [contentDays, setContentDays] = useState(90);
  const [auditDays, setAuditDays] = useState(180);
  const [result, setResult] = useState<{ dry_run: boolean; summary: Record<string, number> } | null>(null);
  const [running, setRunning] = useState(false);

  const orgId = org?.id;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
  }, []);

  const runCleanup = async (dryRun: boolean) => {
    if (!orgId) return;
    setRunning(true);
    setResult(null);
    try {
      const data = await api.retention.cleanup(orgId, {
        content_days: contentDays,
        audit_days: auditDays,
        dry_run: dryRun,
      });
      setResult(data);
    } catch {}
    setRunning(false);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Clock className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Data Retention</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Content Retention</h2>
            <p className="text-sm text-gray-400 mb-4">
              Automatically delete content older than the specified number of days.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={30}
                max={365}
                value={contentDays}
                onChange={(e) => setContentDays(parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={30}
                  max={365}
                  value={contentDays}
                  onChange={(e) => setContentDays(Math.max(30, Math.min(365, parseInt(e.target.value) || 30)))}
                  className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400 text-sm">days</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Audit Log Retention</h2>
            <p className="text-sm text-gray-400 mb-4">
              Automatically delete audit log entries older than the specified number of days.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={30}
                max={730}
                value={auditDays}
                onChange={(e) => setAuditDays(parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={30}
                  max={730}
                  value={auditDays}
                  onChange={(e) => setAuditDays(Math.max(30, Math.min(730, parseInt(e.target.value) || 30)))}
                  className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400 text-sm">days</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => runCleanup(true)}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                {running ? "Running..." : "Dry Run"}
              </button>
              <button
                onClick={() => runCleanup(false)}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {running ? "Running..." : "Run Cleanup"}
              </button>
            </div>

            {result && (
              <div className={`mt-4 p-4 rounded-lg ${result.dry_run ? "bg-yellow-900/30 border border-yellow-700" : "bg-green-900/30 border border-green-700"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.dry_run ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-green-400" />
                  )}
                  <span className="font-medium text-sm">
                    {result.dry_run ? "Dry Run Result" : "Cleanup Complete"}
                  </span>
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                  {Object.entries(result.summary).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-mono">{val}</span>
                    </div>
                  ))}
                  {Object.keys(result.summary).length === 0 && (
                    <p className="text-gray-400">Nothing to clean up.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
