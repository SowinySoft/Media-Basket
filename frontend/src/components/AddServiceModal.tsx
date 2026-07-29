"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { X, Youtube, MessageCircle, Phone } from "lucide-react";

const connectors = [
  {
    type: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    bg: "bg-red-500/10",
    description: "Videos, comments, analytics",
  },
  {
    type: "reddit",
    name: "Reddit",
    icon: MessageCircle,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    description: "Posts, comments, mod queue",
  },
  {
    type: "whatsapp",
    name: "WhatsApp Business",
    icon: Phone,
    color: "text-green-500",
    bg: "bg-green-500/10",
    description: "Conversations, messages",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddServiceModal({ open, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const { createService } = useStore();

  if (!open) return null;

  const handleCreate = async () => {
    if (!selected || !displayName.trim()) return;
    setCreating(true);
    await createService(selected, displayName.trim());
    setCreating(false);
    setSelected(null);
    setDisplayName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Add Service</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Service Name
          </label>
          <input
            type="text"
            placeholder="My YouTube Channel"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="block text-sm font-medium text-gray-300 mt-4">
            Platform
          </label>
          <div className="grid grid-cols-3 gap-3">
            {connectors.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.type}
                  onClick={() => {
                    setSelected(c.type);
                    if (!displayName) setDisplayName(c.name);
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition ${
                    selected === c.type
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                  }`}
                >
                  <Icon className={`w-8 h-8 ${c.color}`} />
                  <span className="text-sm text-white">{c.name}</span>
                  <span className="text-xs text-gray-400 text-center">
                    {c.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || !displayName.trim() || creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {creating ? "Creating..." : "Create Service"}
          </button>
        </div>
      </div>
    </div>
  );
}
