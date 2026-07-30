"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { MessageSquare, AtSign, Send, RefreshCw, Trash2 } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
  };
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function TwitterPanel({ serviceId, onClose }: Props) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [mentions, setMentions] = useState<Tweet[]>([]);
  const [activeTab, setActiveTab] = useState<"tweets" | "mentions">("tweets");
  const [loading, setLoading] = useState(true);
  const [tweetText, setTweetText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchTweets = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/twitter/tweets`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setTweets(data.tweets || []);
      }
    } catch (err) {
      console.error("Failed to fetch tweets:", err);
    }
  };

  const fetchMentions = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/twitter/mentions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setMentions(data.mentions || []);
      }
    } catch (err) {
      console.error("Failed to fetch mentions:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTweets(), fetchMentions()]);
      setLoading(false);
    };
    load();
  }, [serviceId]);

  const handleTweet = async () => {
    if (!tweetText.trim()) return;
    try {
      const params = new URLSearchParams({ message: tweetText });
      if (replyTo) params.append("reply_to", replyTo);
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/twitter/tweet?${params}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setTweetText("");
      setReplyTo(null);
      await fetchTweets();
    } catch (err) {
      console.error("Failed to tweet:", err);
    }
  };

  const handleDelete = async (tweetId: string) => {
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/twitter/tweet/${tweetId}/action?action=delete`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setTweets(tweets.filter((t) => t.id !== tweetId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const renderTweet = (tweet: Tweet) => (
    <div key={tweet.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <p className="text-sm text-gray-300 mb-2">{tweet.text}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{new Date(tweet.created_at).toLocaleDateString()}</span>
        {tweet.public_metrics && (
          <>
            <span>{tweet.public_metrics.like_count} likes</span>
            <span>{tweet.public_metrics.retweet_count} retweets</span>
            <span>{tweet.public_metrics.reply_count} replies</span>
          </>
        )}
        <button
          onClick={() => {
            setReplyTo(tweet.id);
            setTweetText(`@username `);
          }}
          className="text-blue-400 hover:underline"
        >
          Reply
        </button>
        <button
          onClick={() => handleDelete(tweet.id)}
          className="text-red-400 hover:underline"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <ServicePanel serviceId={serviceId} connectorType="twitter" title="Twitter/X Manager" onClose={onClose}>
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab("tweets")}
          className={`flex-1 p-3 text-sm font-medium ${
            activeTab === "tweets"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Tweets ({tweets.length})
        </button>
        <button
          onClick={() => setActiveTab("mentions")}
          className={`flex-1 p-3 text-sm font-medium ${
            activeTab === "mentions"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <AtSign className="w-4 h-4 inline mr-2" />
          Mentions ({mentions.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : activeTab === "tweets" ? (
          tweets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tweets yet</div>
          ) : (
            tweets.map(renderTweet)
          )
        ) : mentions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No mentions yet</div>
        ) : (
          mentions.map(renderTweet)
        )}
      </div>

      {/* Compose */}
      <div className="p-4 border-t border-gray-700">
        {replyTo && (
          <div className="mb-2 text-xs text-gray-400">
            Replying to tweet {replyTo.slice(0, 8)}...
            <button onClick={() => setReplyTo(null)} className="ml-2 text-red-400">Cancel</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={replyTo ? "Write a reply..." : "What's happening?"}
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleTweet()}
          />
          <button
            onClick={handleTweet}
            disabled={!tweetText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ServicePanel>
  );
}
