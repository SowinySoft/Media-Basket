"use client";

import { useState, useEffect } from "react";
import { Sparkles, Check, X, RefreshCw } from "lucide-react";

interface Suggestion {
  id: string;
  content_type: string;
  title: string;
  body: string;
  connector_type: string | null;
  score: number;
  status: string;
  created_at: string;
}

interface Props {
  orgId: string;
  onUse?: (title: string, body: string) => void;
}

export default function ContentSuggestions({ orgId, onUse }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetchSuggestions();
  }, [orgId, filter]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/suggestions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setSuggestions(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/suggestions/generate?count=5`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) await fetchSuggestions();
    } catch {} finally {
      setIsGenerating(false);
    }
  };

  const handleUse = async (s: Suggestion) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/suggestions/${s.id}/use`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      onUse?.(s.title, s.body);
      await fetchSuggestions();
    } catch {}
  };

  const handleDismiss = async (id: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/suggestions/${id}/dismiss`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchSuggestions();
    } catch {}
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.6) return "text-yellow-400";
    return "text-gray-400";
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Content Ideas</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="used">Used</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Generate
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No suggestions yet</p>
            <p className="text-gray-600 text-xs mt-1">Click Generate to get AI-powered content ideas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {suggestions.map((s) => (
              <div key={s.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{s.title}</h3>
                      <span className={`text-xs ${getScoreColor(s.score)}`}>
                        {Math.round(s.score * 100)}%
                      </span>
                      {s.status !== "pending" && (
                        <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                          {s.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{s.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{s.content_type}</span>
                      {s.connector_type && (
                        <span className="text-xs text-gray-500">{s.connector_type}</span>
                      )}
                    </div>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleUse(s)}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded"
                        title="Use suggestion"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDismiss(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
