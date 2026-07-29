"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { ThumbsUp, MessageSquare, Eye, Send, Trash2, Flag, CheckCircle, RefreshCw, ExternalLink } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface RedditComment {
  id: string;
  author: string;
  author_avatar: string;
  body: string;
  score: number;
  created_utc: string;
  replies?: RedditComment[];
}

interface SubredditInfo {
  name: string;
  title: string;
  description: string;
  subscribers: string;
  active_users: string;
  icon: string;
}

interface Props {
  serviceId: string;
  postId: string;
  postTitle: string;
  postBody: string;
  stats: { score: string; comments: string };
  onClose: () => void;
}

export default function RedditPanel({ serviceId, postId, postTitle, postBody, stats, onClose }: Props) {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [subreddit, setSubreddit] = useState<SubredditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchComments = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/reddit/post/${postId}/comments`,
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

  const fetchSubreddit = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/reddit/subreddit`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSubreddit(data.subreddit);
      }
    } catch (err) {
      console.error("Failed to fetch subreddit:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchComments(), fetchSubreddit()]);
      setLoading(false);
    };
    load();
  }, [serviceId, postId]);

  const handleModerate = async (commentId: string, action: string) => {
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/reddit/comment/${commentId}/action?action=${action}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Moderate failed:", err);
    }
  };

  const handleReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/reddit/comment/${commentId}/reply?message=${encodeURIComponent(replyText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText("");
      setReplyTo(null);
    } catch (err) {
      console.error("Reply failed:", err);
    }
    setSending(false);
  };

  const renderComment = (comment: RedditComment, depth = 0) => (
    <div
      key={comment.id}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3"
      style={{ marginLeft: depth * 16 }}
    >
      <div className="flex items-start gap-2">
        {comment.author_avatar && (
          <img src={comment.author_avatar} alt="" className="w-8 h-8 rounded-full" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">u/{comment.author}</span>
            <span className="text-xs text-gray-500">{new Date(Number(comment.created_utc) * 1000).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-gray-300 mt-1">{comment.body}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" /> {comment.score}
            </span>
            <button
              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              className="text-xs text-blue-400 hover:underline"
            >
              Reply
            </button>
            <button
              onClick={() => handleModerate(comment.id, "approve")}
              className="text-xs text-green-400 hover:underline flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" /> Approve
            </button>
            <button
              onClick={() => handleModerate(comment.id, "flag")}
              className="text-xs text-yellow-400 hover:underline flex items-center gap-1"
            >
              <Flag className="w-3 h-3" /> Flag
            </button>
            <button
              onClick={() => handleModerate(comment.id, "delete")}
              className="text-xs text-red-400 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>

          {replyTo === comment.id && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleReply(comment.id)}
              />
              <button
                onClick={() => handleReply(comment.id)}
                disabled={sending || !replyText.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ServicePanel serviceId={serviceId} connectorType="reddit" title="Reddit Manager" onClose={onClose}>
      {/* Subreddit Info */}
      {subreddit && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {subreddit.icon && (
              <img src={subreddit.icon} alt="" className="w-12 h-12 rounded-full" />
            )}
            <div>
              <h3 className="font-medium text-white">r/{subreddit.name}</h3>
              <p className="text-xs text-gray-400">{subreddit.title}</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            <span>{subreddit.subscribers} subscribers</span>
            <span>{subreddit.active_users} online</span>
          </div>
        </div>
      )}

      {/* Post Content */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-medium text-white text-sm mb-2">{postTitle}</h3>
        <p className="text-sm text-gray-300">{postBody}</p>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {stats.score} points</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {stats.comments} comments</span>
        </div>
      </div>

      {/* Comments */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-white text-sm">Comments ({comments.length})</h4>
          <button onClick={fetchComments} className="p-1 hover:bg-gray-700 rounded" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No comments yet</div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
      </div>
    </ServicePanel>
  );
}
