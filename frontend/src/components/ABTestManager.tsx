"use client";

import { useState, useEffect } from "react";
import { FlaskConical, Plus, Trash2, Play, Square, Trophy } from "lucide-react";

interface ABTestItem {
  id: string;
  name: string;
  variants: { name: string; content: string; connector_type?: string }[];
  status: string;
  winner_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface Props {
  orgId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "text-gray-400 bg-gray-700",
  running: "text-green-400 bg-green-900/30",
  completed: "text-blue-400 bg-blue-900/30",
  cancelled: "text-red-400 bg-red-900/30",
};

export default function ABTestManager({ orgId }: Props) {
  const [tests, setTests] = useState<ABTestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [variants, setVariants] = useState([{ name: "A", content: "" }, { name: "B", content: "" }]);

  useEffect(() => {
    fetchTests();
  }, [orgId]);

  const fetchTests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/ab-tests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTests(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName || variants.some((v) => !v.content)) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/ab-tests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, variants }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName("");
        setVariants([{ name: "A", content: "" }, { name: "B", content: "" }]);
        await fetchTests();
      }
    } catch {}
  };

  const handleStart = async (id: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/ab-tests/${id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTests();
    } catch {}
  };

  const handleStop = async (id: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/ab-tests/${id}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTests();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this test?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/ab-tests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTests();
    } catch {}
  };

  const addVariant = () => {
    const letter = String.fromCharCode(65 + variants.length);
    setVariants([...variants, { name: letter, content: "" }]);
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">A/B Tests</span>
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
            placeholder="Test name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(i, "name", e.target.value)}
                  className="w-16 px-2 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={v.content}
                  onChange={(e) => updateVariant(i, "content", e.target.value)}
                  className="flex-1 px-2 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none"
                  placeholder="Content"
                />
                {variants.length > 2 && (
                  <button onClick={() => removeVariant(i)} className="text-gray-400 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addVariant} className="text-blue-400 text-xs hover:underline">+ Add Variant</button>
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
        ) : tests.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No A/B tests yet</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {tests.map((t) => (
              <div key={t.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm text-white">{t.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[t.status]}`}>
                        {t.status}
                      </span>
                      {t.winner_id && (
                        <Trophy className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {t.variants.map((v, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          {v.name}: {v.content.slice(0, 30)}...
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {t.status === "draft" && (
                      <button onClick={() => handleStart(t.id)} className="p-1 text-gray-400 hover:text-green-400" title="Start">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {t.status === "running" && (
                      <button onClick={() => handleStop(t.id)} className="p-1 text-gray-400 hover:text-yellow-400" title="Stop">
                        <Square className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-400 hover:text-red-400">
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
