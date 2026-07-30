"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Camera, RefreshCw } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface SnapchatStory {
  id: string;
  type: string;
  created_at: string;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function SnapchatPanel({ serviceId, onClose }: Props) {
  const [stories, setStories] = useState<SnapchatStory[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchStories = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/snapchat/stories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories || []);
      }
    } catch (err) {
      console.error("Failed to fetch stories:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStories();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  return (
    <ServicePanel serviceId={serviceId} connectorType="snapchat" title="Snapchat Manager" onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">Stories</h4>
          <button onClick={fetchStories} className="p-2 hover:bg-gray-700 rounded">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">No stories found</div>
        ) : (
          <div className="space-y-3">
            {stories.map((story) => (
              <div key={story.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-white">{story.type || "Story"}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(story.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ServicePanel>
  );
}
