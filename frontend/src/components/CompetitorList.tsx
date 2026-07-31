"use client";

import { useState, useEffect } from "react";
import { Eye, Plus, Trash2, RefreshCw, ExternalLink } from "lucide-react";

interface Competitor {
  id: string;
  connector_type: string;
  external_id: string;
  display_name: string;
  competitor_metadata: Record<string, any> | null;
  last_synced_at: string | null;
  created_at: string;
}

interface Props {
  orgId: string;
}

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter/X" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "reddit", label: "Reddit" },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "text-red-400",
  twitter: "text-sky-400",
  instagram: "text-pink-400",
  facebook: "text-blue-400",
  linkedin: "text-blue-600",
  tiktok: "text-gray-300",
  reddit: "text-orange-400",
};

export default function CompetitorList({ orgId }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlatform, setNewPlatform] = useState("youtube");
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchCompetitors();
  }, [orgId]);

  const fetchCompetitors = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/competitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCompetitors(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newId || !newName) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/competitors`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_type: newPlatform,
          external_id: newId,
          display_name: newName,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewId("");
        setNewName("");
        await fetchCompetitors();
      }
    } catch {}
  };

  const handleSync = async (id: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/competitors/${id}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCompetitors();
    } catch {}
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this competitor?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/competitors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCompetitors();
    } catch {}
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Competitors</span>
          <span className="text-xs text-gray-400">({competitors.length})</span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 space-y-3">
          <select
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Account ID or username"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : competitors.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No competitors tracked</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {competitors.map((c) => (
              <div key={c.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye className={`w-4 h-4 ${PLATFORM_COLORS[c.connector_type] || "text-gray-400"}`} />
                    <div>
                      <p className="text-sm text-white">{c.display_name}</p>
                      <p className="text-xs text-gray-400">
                        {c.connector_type} · {c.external_id}
                        {c.last_synced_at && ` · synced ${new Date(c.last_synced_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSync(c.id)}
                      className="p-1 text-gray-400 hover:text-green-400"
                      title="Sync"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRemove(c.id)} className="p-1 text-gray-400 hover:text-red-400">
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
