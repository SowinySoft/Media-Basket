"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Hash, Send, RefreshCw, Users } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  topic?: string;
}

interface DiscordMessage {
  id: string;
  content: string;
  author?: { username: string; discriminator: string };
  timestamp: string;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function DiscordPanel({ serviceId, onClose }: Props) {
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchChannels = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/discord/guilds`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.guilds?.length > 0) {
          const channelsRes = await fetch(
            `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/discord/guild/${data.guilds[0].id}/channels`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (channelsRes.ok) {
            const channelsData = await channelsRes.json();
            setChannels(channelsData.channels || []);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    }
  };

  const fetchMessages = async (channelId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/discord/channel/${channelId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchChannels();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel);
    }
  }, [selectedChannel]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedChannel) return;
    setSending(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/discord/channel/${selectedChannel}/send?message=${encodeURIComponent(messageText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setMessageText("");
      await fetchMessages(selectedChannel);
    } catch (err) {
      console.error("Failed to send:", err);
    }
    setSending(false);
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="discord" title="Discord Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Channels list */}
        <div className="w-64 border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h4 className="text-sm font-medium text-white">Channels</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No channels found</div>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-800 ${
                  selectedChannel === channel.id ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white truncate">{channel.name}</span>
                </div>
                {channel.topic && (
                  <p className="text-xs text-gray-500 ml-6 truncate">{channel.topic}</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          {selectedChannel ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {msg.author?.username || "User"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{msg.content}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !messageText.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a channel to view messages</p>
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
