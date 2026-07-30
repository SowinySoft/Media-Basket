"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Send, RefreshCw, MessageCircle } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface TelegramMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

interface TelegramChat {
  id: string;
  payload: any;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function TelegramPanel({ serviceId, onClose }: Props) {
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchChats = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/telegram/chats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/telegram/chat/${chatId}/messages`,
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
      await fetchChats();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat);
    }
  }, [selectedChat]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedChat) return;
    setSending(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/telegram/send?chat_id=${selectedChat}&message=${encodeURIComponent(messageText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setMessageText("");
      await fetchMessages(selectedChat);
    } catch (err) {
      console.error("Failed to send:", err);
    }
    setSending(false);
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="telegram" title="Telegram Manager" onClose={onClose}>
      <div className="flex h-full">
        {/* Chat list */}
        <div className="w-64 border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h4 className="text-sm font-medium text-white">Chats</h4>
          </div>
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No chats found</div>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-800 ${
                  selectedChat === chat.id ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white truncate">
                    {chat.payload?.title || chat.payload?.first_name || `Chat ${chat.id}`}
                  </span>
                </div>
                <span className="text-xs text-gray-500 ml-6">{chat.payload?.type || ""}</span>
              </button>
            ))
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">@{msg.from}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{msg.text}</p>
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
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a chat to view messages</p>
            </div>
          )}
        </div>
      </div>
    </ServicePanel>
  );
}
