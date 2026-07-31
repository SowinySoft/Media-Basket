"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import TreeView from "@/components/TreeView";
import ContentDetail from "@/components/ContentDetail";
import AddServiceModal from "@/components/AddServiceModal";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useKeyboardShortcuts([
    { key: "k", ctrl: true, action: () => { document.querySelector<HTMLInputElement>("[placeholder='Search content...']")?.focus(); }, description: "Quick Search" },
    { key: "n", ctrl: true, action: () => setShowAddService(true), description: "New Service" },
    { key: "Escape", action: () => { setShowAddService(false); setShowShortcuts(false); }, description: "Close Modal" },
    { key: "/", ctrl: true, action: () => setShowShortcuts((v) => !v), description: "Show Shortcuts" },
  ]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  const handleContentSelect = () => {
    // Close sidebar on mobile after selecting content
    if (isMobile) setSidebarOpen(false);
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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

      {/* Mobile nav */}
      <MobileNav
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        onAddService={() => setShowAddService(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile ? "fixed inset-y-0 left-0 z-40 w-72 pt-24" : "relative w-80"}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
          transition-transform duration-200 ease-in-out
          bg-gray-800 border-r border-gray-700 flex flex-col
        `}
      >
        {/* Desktop header */}
        {!isMobile && (
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
        )}

        {/* Mobile sidebar header */}
        {isMobile && (
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-white">Media Basket</h1>
              <ThemeToggle />
            </div>
          </div>
        )}

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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 bg-gray-900 ${isMobile ? "pt-24" : ""}`}>
        {selectedContentId ? (
          <ContentDetail />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 px-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2 text-white">Welcome to Media Basket</h2>
              <p className="text-sm sm:text-base">Select an item from the tree to view details</p>
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
