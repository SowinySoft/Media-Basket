"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Video, Send, RefreshCw, Heart, MessageCircle, Share2 } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface TikTokVideo {
  id: string;
  title?: string;
  create_time: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

interface TikTokComment {
  id: string;
  text: string;
  user?: { nickname: string; avatar_thumb?: { url_list: string[] } };
  create_time: number;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function TikTokPanel({ serviceId, onClose }: Props) {
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [comments, setComments] = useState<TikTokComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchVideos = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/tiktok/videos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    }
  };

  const fetchComments = async (videoId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/tiktok/video/${videoId}/comments`,
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
      await fetchVideos();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  useEffect(() => {
    if (selectedVideo) {
      fetchComments(selectedVideo);
    }
  }, [selectedVideo]);

  const handleComment = async () => {
    if (!commentText.trim() || !selectedVideo) return;
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/tiktok/video/${selectedVideo}/comment?message=${encodeURIComponent(commentText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentText("");
      await fetchComments(selectedVideo);
    } catch (err) {
      console.error("Failed to comment:", err);
    }
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="tiktok" title="TikTok Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Videos list */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h4 className="text-sm font-medium text-white">Videos</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : videos.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No videos found</div>
          ) : (
            videos.map((video) => (
              <button
                key={video.id}
                onClick={() => setSelectedVideo(video.id)}
                className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-800 ${
                  selectedVideo === video.id ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Video className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-medium text-white truncate">
                    {video.title || "TikTok Video"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {video.like_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {video.comment_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="w-3 h-3" /> {video.share_count || 0}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Video detail + comments */}
        <div className="flex-1 flex flex-col">
          {selectedVideo ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">
                    {videos.find((v) => v.id === selectedVideo)?.title || "No title"}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> {videos.find((v) => v.id === selectedVideo)?.like_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" /> {videos.find((v) => v.id === selectedVideo)?.comment_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-4 h-4" /> {videos.find((v) => v.id === selectedVideo)?.share_count || 0}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-medium text-white border-b border-gray-700 pb-2">Comments</h4>
                {comments.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">No comments yet</div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          {comment.user?.nickname || "User"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {comment.create_time ? new Date(comment.create_time * 1000).toLocaleDateString() : ""}
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
                    className="px-4 py-2 bg-pink-600 text-white rounded text-sm hover:bg-pink-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a video to view details</p>
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
