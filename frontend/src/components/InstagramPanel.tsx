"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Image, MessageSquare, Send, RefreshCw } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url: string;
  permalink: string;
  timestamp: string;
}

interface InstagramComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function InstagramPanel({ serviceId, onClose }: Props) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchPosts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/instagram/posts`,
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

  const fetchComments = async (mediaId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/instagram/media/${mediaId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
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

  useEffect(() => {
    if (selectedPost) {
      fetchComments(selectedPost);
    }
  }, [selectedPost]);

  const handleComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/instagram/media/${selectedPost}/comment?message=${encodeURIComponent(commentText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentText("");
      await fetchComments(selectedPost);
    } catch (err) {
      console.error("Failed to comment:", err);
    }
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="instagram" title="Instagram Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Posts grid */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h4 className="text-sm font-medium text-white">Posts</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : posts.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No posts found</div>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-1">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post.id)}
                  className={`aspect-square rounded overflow-hidden border-2 ${
                    selectedPost === post.id ? "border-blue-500" : "border-transparent"
                  }`}
                >
                  {post.media_url ? (
                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="flex-1 flex flex-col">
          {selectedPost ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {comments.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8">No comments yet</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">@{comment.username}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a post to view comments</p>
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
