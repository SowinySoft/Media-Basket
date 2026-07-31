"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Plugin {
  name: string;
  display_name: string;
  description: string;
  version: string;
  tier: string;
  author: string;
  category: string;
  install_count: number;
  rating: number;
  capabilities: { reads?: string[]; writes?: string[] };
  tags: string[];
}

interface Category {
  name: string;
  count: number;
}

const CATEGORIES = ["All", "analytics", "moderation", "publishing", "notifications", "scheduling"];

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-yellow-400 text-sm">
      {"★".repeat(rounded)}{"☆".repeat(5 - rounded)}
      <span className="text-gray-400 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function PluginCard({ plugin, onInstall, installing }: { plugin: Plugin; onInstall: (name: string) => void; installing: boolean }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 hover:border-blue-500 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-white font-semibold text-lg">{plugin.display_name}</h3>
          <p className="text-gray-400 text-sm">by {plugin.author}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${plugin.tier === "full" ? "bg-blue-600 text-blue-100" : "bg-gray-600 text-gray-200"}`}>
          {plugin.tier}
        </span>
      </div>
      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{plugin.description}</p>
      <StarRating rating={plugin.rating} />
      <p className="text-gray-500 text-xs mt-1 mb-3">{plugin.install_count} installs</p>
      <div className="flex flex-wrap gap-1 mb-4">
        {plugin.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
            {tag}
          </span>
        ))}
      </div>
      <button
        onClick={() => onInstall(plugin.name)}
        disabled={installing}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors"
      >
        {installing ? "Installing..." : "Install"}
      </button>
    </div>
  );
}

function PluginModal({ plugin, onClose, onInstall, installing }: { plugin: Plugin; onClose: () => void; onInstall: (name: string) => void; installing: boolean }) {
  if (!plugin) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white text-xl font-bold">{plugin.display_name}</h2>
            <p className="text-gray-400 text-sm">by {plugin.author} · v{plugin.version}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <p className="text-gray-300 text-sm mb-4">{plugin.description}</p>
        <div className="mb-4">
          <h4 className="text-gray-200 text-sm font-semibold mb-1">Capabilities</h4>
          <div className="flex gap-4 text-xs">
            {plugin.capabilities.reads && (
              <div>
                <span className="text-gray-500">Reads:</span>{" "}
                <span className="text-gray-300">{plugin.capabilities.reads.join(", ")}</span>
              </div>
            )}
            {plugin.capabilities.writes && (
              <div>
                <span className="text-gray-500">Writes:</span>{" "}
                <span className="text-gray-300">{plugin.capabilities.writes.join(", ")}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${plugin.tier === "full" ? "bg-blue-600 text-blue-100" : "bg-gray-600 text-gray-200"}`}>
            {plugin.tier}
          </span>
          <StarRating rating={plugin.rating} />
          <span className="text-gray-500 text-xs self-center">{plugin.install_count} installs</span>
        </div>
        <button
          onClick={() => onInstall(plugin.name)}
          disabled={installing}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors"
        >
          {installing ? "Installing..." : "Install Plugin"}
        </button>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlugins();
    loadCategories();
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [activeCategory, search]);

  async function loadPlugins() {
    try {
      setLoading(true);
      const params: { category?: string; search?: string } = {};
      if (activeCategory !== "All") params.category = activeCategory;
      if (search) params.search = search;
      const data = await api.marketplace.listCatalog(params);
      setPlugins(data);
    } catch (err) {
      console.error("Failed to load marketplace:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await api.marketplace.getCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  async function handleInstall(name: string) {
    try {
      setInstalling(name);
      await api.marketplace.install(name);
      await loadPlugins();
    } catch (err: any) {
      alert(err.message || "Install failed");
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Plugin Marketplace</h1>
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No plugins found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((plugin) => (
              <div key={plugin.name} onClick={() => setSelectedPlugin(plugin)} className="cursor-pointer">
                <PluginCard plugin={plugin} onInstall={handleInstall} installing={installing === plugin.name} />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlugin && (
        <PluginModal
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onInstall={handleInstall}
          installing={installing === selectedPlugin.name}
        />
      )}
    </div>
  );
}
