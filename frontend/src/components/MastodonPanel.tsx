"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { AtSign, Send, RefreshCw, Heart, Repeat2, MessageCircle } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface MastodonStatus {
  id: string;
  content: string;
  account?: { username: string; display_name: string };
  created_at: string;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function MastodonPanel({ serviceId, onClose }: Props) {
  const [statuses, setStatuses] = useState<MastodonStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState("");
  const [composing, setComposing] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchStatuses = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/mastodon/statuses`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || []);
      }
    } catch (err) {
      console.error("Failed to fetch statuses:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStatuses();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  const handleCompose = async () => {
    if (!composeText.trim()) return;
    setComposing(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/mastodon/status?message=${encodeURIComponent(composeText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setComposeText("");
      await fetchStatuses();
    } catch (err) {
      console.error("Failed to post:", err);
    }
    setComposing(false);
  };

  const handleFavourite = async (statusId: string) => {
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/mastodon/status/${statusId}/favourite`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchStatuses();
    } catch (err) {
      console.error("Failed to favourite:", err);
    }
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="mastodon" title="Mastodon Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Compose */}
        <div className="w-80 border-r border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700">
            <h4 className="text-sm font-medium text-white">Compose</h4>
          </div>
          <div className="p-4 flex-1">
            <textarea
              placeholder="What's on your mind?"
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleCompose}
              disabled={composing || !composeText.trim()}
              className="mt-2 w-full py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {composing ? "Posting..." : "Post"}
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 sticky top-0 bg-gray-800">
            <h4 className="text-sm font-medium text-white">Feed</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : statuses.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No statuses found</div>
          ) : (
            <div className="space-y-1">
              {statuses.map((status) => (
                <div key={status.id} className="p-4 border-b border-gray-700 hover:bg-gray-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AtSign className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">
                      {status.account?.display_name || status.account?.username || "User"}
                    </span>
                    <span className="text-xs text-gray-500">
                      @{status.account?.username}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(status.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div
                    className="text-sm text-gray-300 mb-2"
                    dangerouslySetInnerHTML={{ __html: status.content }}
                  />
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button
                      onClick={() => handleFavourite(status.id)}
                      className="flex items-center gap-1 hover:text-pink-500"
                    >
                      <Heart className="w-3 h-3" /> {status.favourites_count || 0}
                    </button>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" /> {status.reblogs_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {status.replies_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
