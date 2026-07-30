"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Send, RefreshCw, Heart, Repeat2, MessageCircle } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface BlueskyPost {
  id: string;
  record?: { text: string; createdAt: string };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function BlueskyPanel({ serviceId, onClose }: Props) {
  const [posts, setPosts] = useState<BlueskyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState("");
  const [composing, setComposing] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchPosts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/bluesky/feed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchPosts();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  const handleCompose = async () => {
    if (!composeText.trim()) return;
    setComposing(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/bluesky/post?message=${encodeURIComponent(composeText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setComposeText("");
      await fetchPosts();
    } catch (err) {
      console.error("Failed to post:", err);
    }
    setComposing(false);
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="bluesky" title="Bluesky Manager" onClose={onClose}>
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
              className="mt-2 w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {composing ? "Posting..." : "Post"}
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 sticky top-0 bg-gray-800 flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Feed</h4>
            <button onClick={fetchPosts} className="p-1 hover:bg-gray-700 rounded">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : posts.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No posts found</div>
          ) : (
            <div className="space-y-1">
              {posts.map((post) => (
                <div key={post.id} className="p-4 border-b border-gray-700 hover:bg-gray-800/50">
                  <p className="text-sm text-gray-300 mb-2">
                    {post.record?.text || "No content"}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {post.likeCount || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" /> {post.repostCount || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {post.replyCount || 0}
                    </span>
                    <span className="ml-auto">
                      {post.record?.createdAt ? new Date(post.record.createdAt).toLocaleDateString() : ""}
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
