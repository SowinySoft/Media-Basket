"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { X, Youtube, MessageCircle, Phone, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const connectors = [
  {
    type: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    bg: "bg-red-500/10",
    description: "Videos, comments, analytics",
    setupHint: "Click Connect to authorize with your Google account",
    needsOAuth: true,
  },
  {
    type: "reddit",
    name: "Reddit",
    icon: MessageCircle,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    description: "Posts, comments, mod queue",
    setupHint: "Click Connect to authorize with your Reddit account",
    needsOAuth: true,
  },
  {
    type: "whatsapp",
    name: "WhatsApp Business",
    icon: Phone,
    color: "text-green-500",
    bg: "bg-green-500/10",
    description: "Conversations, messages",
    setupHint: "Requires WhatsApp Business API access",
    needsOAuth: false,
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
  const [step, setStep] = useState<"select" | "creating" | "connecting" | "done" | "error">("select");
  const [error, setError] = useState<string | null>(null);
  const { createService, connectService } = useStore();

  if (!open) return null;

  const selectedConnector = connectors.find((c) => c.type === selected);

  const handleCreate = async () => {
    if (!selected || !displayName.trim()) return;
    setCreating(true);
    setStep("creating");
    setError(null);

    try {
      // Create the service
      const token = localStorage.getItem("access_token");
      const orgId = useStore.getState().org?.id;
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/orgs/${orgId}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connector_type: selected, display_name: displayName.trim() }),
      });

      if (!res.ok) throw new Error("Failed to create service");
      const service = await res.json();

      // If connector needs OAuth, redirect to connect
      if (selectedConnector?.needsOAuth) {
        setStep("connecting");
        setCreating(false);
        await connectService(service.id, selected);
      } else {
        setStep("done");
        setCreating(false);
        setTimeout(() => {
          resetAndClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message);
      setStep("error");
      setCreating(false);
    }
  };

  const resetAndClose = () => {
    setSelected(null);
    setDisplayName("");
    setStep("select");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {step === "select" ? "Add Service" : 
             step === "connecting" ? "Connecting..." :
             step === "done" ? "Connected!" :
             step === "error" ? "Error" : "Creating..."}
          </h2>
          <button onClick={resetAndClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4">
          {step === "select" && (
            <div className="space-y-3">
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

              {selectedConnector && (
                <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span>{selectedConnector.setupHint}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "connecting" && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-white mb-2">Redirecting to {selectedConnector?.name}...</p>
              <p className="text-sm text-gray-400">Complete the authorization in the popup window</p>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-white mb-2">Successfully connected!</p>
              <p className="text-sm text-gray-400">Syncing your content...</p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-white mb-2">Connection failed</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          )}
        </div>

        {step === "select" && (
          <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
            <button
              onClick={resetAndClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selected || !displayName.trim() || creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {selectedConnector?.needsOAuth ? "Create & Connect" : "Create Service"}
            </button>
          </div>
        )}

        {(step === "done" || step === "error") && (
          <div className="flex justify-end p-4 border-t border-gray-700">
            <button
              onClick={resetAndClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
