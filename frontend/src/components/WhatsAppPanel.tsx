"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Send, Trash2, Flag, CheckCircle, RefreshCw, Phone, MessageCircle } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  status: string;
}

interface WhatsAppContact {
  phone_number: string;
  name: string;
  avatar: string;
  last_seen: string;
}

interface Props {
  serviceId: string;
  conversationId: string;
  contactName: string;
  onClose: () => void;
}

export default function WhatsAppPanel({ serviceId, conversationId, contactName, onClose }: Props) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [contact, setContact] = useState<WhatsAppContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/whatsapp/conversation/${conversationId}/messages`,
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

  const fetchContact = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/whatsapp/contact/${conversationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setContact(data.contact);
      }
    } catch (err) {
      console.error("Failed to fetch contact:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMessages(), fetchContact()]);
      setLoading(false);
    };
    load();
  }, [serviceId, conversationId]);

  const handleModerate = async (messageId: string, action: string) => {
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/whatsapp/message/${messageId}/action?action=${action}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(messages.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("Moderate failed:", err);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/whatsapp/conversation/${conversationId}/reply?message=${encodeURIComponent(replyText)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText("");
    } catch (err) {
      console.error("Reply failed:", err);
    }
    setSending(false);
  };

  return (
    <ServicePanel serviceId={serviceId} connectorType="whatsapp" title="WhatsApp Manager" onClose={onClose}>
      {/* Contact Info */}
      {contact && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {contact.avatar ? (
              <img src={contact.avatar} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                <Phone className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="font-medium text-white">{contact.name || contact.phone_number}</h3>
              <p className="text-xs text-gray-400">{contact.phone_number}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-white text-sm">Messages ({messages.length})</h4>
          <button onClick={fetchMessages} className="p-1 hover:bg-gray-700 rounded" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No messages yet</div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isIncoming = message.from === contact?.phone_number;
              return (
                <div
                  key={message.id}
                  className={`flex ${isIncoming ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      isIncoming ? "bg-gray-800 border border-gray-700" : "bg-blue-600"
                    }`}
                  >
                    <p className={`text-sm ${isIncoming ? "text-gray-300" : "text-white"}`}>
                      {message.body}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {isIncoming && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReplyText(message.body)}
                            className="text-xs text-blue-400 hover:underline"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => handleModerate(message.id, "approve")}
                            className="text-xs text-green-400 hover:underline"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleModerate(message.id, "flag")}
                            className="text-xs text-yellow-400 hover:underline"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleModerate(message.id, "delete")}
                            className="text-xs text-red-400 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply Input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleReply()}
          />
          <button
            onClick={handleReply}
            disabled={sending || !replyText.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ServicePanel>
  );
}
