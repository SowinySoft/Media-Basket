"use client";

import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2, Play, CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  has_secret: boolean;
  created_at: string;
}

interface Props {
  orgId: string;
}

const AVAILABLE_EVENTS = [
  "content.created",
  "content.flagged",
  "content.approved",
  "content.deleted",
  "alert.triggered",
  "sync.completed",
  "member.joined",
];

export default function WebhookBuilder({ orgId }: Props) {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, [orgId]);

  const fetchWebhooks = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWebhooks(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newUrl || newEvents.length === 0) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          events: newEvents,
          secret: newSecret || null,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewUrl("");
        setNewEvents([]);
        setNewSecret("");
        await fetchWebhooks();
      }
    } catch {}
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchWebhooks();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchWebhooks();
    } catch {}
  };

  const handleTest = async (id: string) => {
    setTestResult(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult({ id, ok: data.ok, error: data.error });
    } catch {
      setTestResult({ id, ok: false, error: "Network error" });
    }
  };

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Webhooks</span>
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
            type="url"
            placeholder="Webhook URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <p className="text-xs text-gray-400 mb-1">Events</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`px-2 py-1 text-xs rounded ${
                    newEvents.includes(event)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="Secret (optional, for signature verification)"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
        ) : webhooks.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No webhooks configured</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {webhooks.map((w) => (
              <div key={w.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${w.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                      <span className="text-sm text-white truncate">{w.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 ml-4">
                      {w.events.map((e) => (
                        <span key={e} className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                    {testResult?.id === w.id && (
                      <div className={`ml-4 mt-1 text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                        {testResult.ok ? "Test successful" : `Test failed: ${testResult.error}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleTest(w.id)}
                      className="p-1 text-gray-400 hover:text-green-400"
                      title="Test"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(w.id, !w.enabled)}
                      className={w.enabled ? "text-green-400" : "text-gray-500"}
                      title={w.enabled ? "Disable" : "Enable"}
                    >
                      {w.enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="p-1 text-gray-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
