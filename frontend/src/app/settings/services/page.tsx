"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Settings, Trash2, RefreshCw, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CONNECTOR_ICONS: Record<string, string> = {
  youtube: "📺", reddit: "🔷", whatsapp: "💬", telegram: "✈️",
  instagram: "📸", twitter: "🐦", facebook: "📘", linkedin: "💼",
  tiktok: "🎵", discord: "🎮", slack: "💼", mastodon: "🐘",
  pinterest: "📌", snapchat: "👻", bluesky: "🦋",
};

export default function ServicesPage() {
  const router = useRouter();
  const { services, fetchServices, syncService, deleteService } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchServices().then(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Settings className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Connected Services</h1>
          </div>
          <ThemeToggle />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : services.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <p className="text-gray-400 mb-4">No services connected yet.</p>
            <button
              onClick={() => router.push("/tree")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Service
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CONNECTOR_ICONS[service.connector_type] || "🔗"}</span>
                  <div>
                    <h3 className="font-medium">{service.display_name}</h3>
                    <p className="text-sm text-gray-400 capitalize">{service.connector_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    service.status === "active" ? "bg-green-900/50 text-green-400" :
                    service.status === "expired" ? "bg-yellow-900/50 text-yellow-400" :
                    "bg-red-900/50 text-red-400"
                  }`}>
                    {service.status}
                  </span>
                  <button
                    onClick={() => syncService(service.id)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                    title="Sync"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => router.push(`/service/${service.id}/content`)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                    title="View Content"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${service.display_name}?`)) deleteService(service.id);
                    }}
                    className="p-2 hover:bg-gray-700 rounded-lg text-red-400"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
