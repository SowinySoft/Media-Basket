"use client";

import { useState } from "react";
import { CheckSquare, Square, Trash2, Flag, CheckCircle, Send } from "lucide-react";

interface ContentItem {
  id: string;
  content_type: string;
  connector_type?: string;
  payload: Record<string, any>;
}

interface Props {
  items: ContentItem[];
  onRefresh: () => void;
  orgId: string;
}

export default function BulkActions({ items, onRefresh, orgId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setIsProcessing(true);
    setResult(null);

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/bulk/moderate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content_ids: Array.from(selected),
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(`${action}: ${data.processed} processed, ${data.errors} errors`);
        setSelected(new Set());
        onRefresh();
      }
    } catch {
      setResult("Error performing bulk action");
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="border border-gray-700 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-gray-400 hover:text-white">
            {selected.size === items.length ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <span className="text-sm text-gray-300">
            {selected.size > 0 ? `${selected.size} selected` : `${items.length} items`}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("flag")}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              <Flag className="w-3 h-3" />
              Flag
            </button>
            <button
              onClick={() => handleBulkAction("approve")}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-3 h-3" />
              Approve
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        )}
      </div>

      {result && (
        <p className="text-xs text-gray-400 mt-2">{result}</p>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {items
            .filter((i) => selected.has(i.id))
            .slice(0, 10)
            .map((i) => (
              <span
                key={i.id}
                className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded cursor-pointer hover:bg-gray-600"
                onClick={() => toggleSelect(i.id)}
              >
                {i.payload?.title || i.payload?.text?.slice(0, 30) || i.content_type}
              </span>
            ))}
          {selected.size > 10 && (
            <span className="px-2 py-0.5 text-gray-500 text-xs">+{selected.size - 10} more</span>
          )}
        </div>
      )}
    </div>
  );
}
