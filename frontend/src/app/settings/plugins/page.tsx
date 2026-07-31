"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Puzzle, ExternalLink } from "lucide-react";

const CONNECTORS = [
  { name: "YouTube", type: "youtube", icon: "📺", tier: "full", status: "built-in" },
  { name: "Reddit", type: "reddit", icon: "🔷", tier: "full", status: "built-in" },
  { name: "WhatsApp Business", type: "whatsapp", icon: "💬", tier: "full", status: "built-in" },
  { name: "Telegram", type: "telegram", icon: "✈️", tier: "full", status: "built-in" },
  { name: "Instagram", type: "instagram", icon: "📸", tier: "full", status: "built-in" },
  { name: "Twitter / X", type: "twitter", icon: "🐦", tier: "full", status: "built-in" },
  { name: "Facebook", type: "facebook", icon: "📘", tier: "full", status: "built-in" },
  { name: "LinkedIn", type: "linkedin", icon: "💼", tier: "lightweight", status: "built-in" },
  { name: "TikTok", type: "tiktok", icon: "🎵", tier: "full", status: "built-in" },
  { name: "Discord", type: "discord", icon: "🎮", tier: "full", status: "built-in" },
  { name: "Slack", type: "slack", icon: "💼", tier: "full", status: "built-in" },
  { name: "Mastodon", type: "mastodon", icon: "🐘", tier: "full", status: "built-in" },
  { name: "Pinterest", type: "pinterest", icon: "📌", tier: "lightweight", status: "built-in" },
  { name: "Snapchat", type: "snapchat", icon: "👻", tier: "lightweight", status: "built-in" },
  { name: "Bluesky", type: "bluesky", icon: "🦋", tier: "full", status: "built-in" },
];

export default function PluginsPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) router.push("/login");
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Puzzle className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Connectors</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
          <p className="text-sm text-gray-400">
            All connectors are built-in. Third-party plugin support is planned for v3.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CONNECTORS.map((c) => (
            <div key={c.type} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{c.tier}</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-green-900/50 text-green-400">
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
