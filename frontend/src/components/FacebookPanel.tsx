"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { MessageSquare, Send, RefreshCw, ExternalLink } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  from?: { name: string; id: string };
}

interface FacebookComment {
  id: string;
  message: string;
  from?: { name: string; id: string };
  created_time: string;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function FacebookPanel({ serviceId, onClose }: Props) {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<FacebookComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchPosts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/facebook/page/current/posts`,
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

  const fetchComments = async (postId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/facebook/post/${postId}/comments`,
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
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/facebook/post/${selectedPost}/comment?message=${encodeURIComponent(commentText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentText("");
      await fetchComments(selectedPost);
    } catch (err) {
      console.error("Failed to comment:", err);
    }
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="facebook" title="Facebook Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Posts list */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 flex gap-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`text-sm px-3 py-1 rounded ${activeTab === "posts" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`text-sm px-3 py-1 rounded ${activeTab === "comments" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Comments
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : activeTab === "posts" ? (
            posts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No posts found</div>
            ) : (
              posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post.id)}
                  className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-800 ${
                    selectedPost === post.id ? "bg-gray-800" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white truncate">
                      {post.from?.name || "Facebook"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{post.message || "No text"}</p>
                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(post.created_time).toLocaleDateString()}
                  </span>
                </button>
              ))
            )
          ) : comments.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">Select a post to view comments</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="p-3 border-b border-gray-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{comment.from?.name || "User"}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_time).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{comment.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Post detail */}
        <div className="flex-1 flex flex-col">
          {selectedPost ? (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">
                    {posts.find((p) => p.id === selectedPost)?.message || "No content"}
                  </p>
                </div>
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
              <p className="text-sm">Select a post to view details</p>
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
