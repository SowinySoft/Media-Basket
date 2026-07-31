"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import TreeView from "@/components/TreeView";
import ContentDetail from "@/components/ContentDetail";
import AddServiceModal from "@/components/AddServiceModal";
import ThemeToggle from "@/components/ThemeToggle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Search, Plus, RefreshCw, LogOut } from "lucide-react";

function TreePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    services,
    searchQuery,
    setSearchQuery,
    selectedContentId,
    fetchUser,
    fetchServices,
    fetchContent,
    syncService,
    logout,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts([
    { key: "k", ctrl: true, action: () => { document.querySelector<HTMLInputElement>("[placeholder='Search content...']")?.focus(); }, description: "Quick Search" },
    { key: "n", ctrl: true, action: () => setShowAddService(true), description: "New Service" },
    { key: "Escape", action: () => { setShowAddService(false); setShowShortcuts(false); }, description: "Close Modal" },
    { key: "/", ctrl: true, action: () => setShowShortcuts((v) => !v), description: "Show Shortcuts" },
  ]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const init = async () => {
      await fetchUser();
      await fetchServices();
      await fetchContent();
      setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected && services.length > 0) {
      const service = services.find((s) => s.connector_type === connected);
      if (service) {
        syncService(service.id);
        router.replace("/tree");
      }
    }
  }, [searchParams, services]);

  useEffect(() => {
    if (user) {
      useStore.getState().connectWebSocket();
    }
    return () => {
      useStore.getState().disconnectWebSocket();
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex items-center gap-2 text-white">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-gray-900">
      {showAddService && <AddServiceModal onClose={() => setShowAddService(false)} />}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                ["Ctrl+K", "Quick Search"],
                ["Ctrl+N", "New Service"],
                ["Ctrl+/", "Toggle Shortcuts"],
                ["Escape", "Close Modal"],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-4 w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">Media Basket</h1>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {services.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">
              <p>No services connected yet.</p>
              <button
                onClick={() => setShowAddService(true)}
                className="mt-2 flex items-center gap-1 text-blue-400 hover:underline"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>
          ) : (
            <TreeView />
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => setShowAddService(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 bg-gray-900">
        {selectedContentId ? (
          <ContentDetail />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2 text-white">Welcome to Media Basket</h2>
              <p>Select an item from the tree to view details</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TreePage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="flex items-center gap-2 text-white">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <p>Loading...</p>
        </div>
      </main>
    }>
      <TreePageInner />
    </Suspense>
  );
}
