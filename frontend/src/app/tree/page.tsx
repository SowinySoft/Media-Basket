"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import TreeView from "@/components/TreeView";
import ContentDetail from "@/components/ContentDetail";
import AddServiceModal from "@/components/AddServiceModal";
import { Search, Plus, RefreshCw, LogOut } from "lucide-react";

export default function TreePage() {
  const router = useRouter();
  const {
    user,
    services,
    searchQuery,
    setSearchQuery,
    selectedContentId,
    fetchUser,
    fetchServices,
    logout,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const init = async () => {
      await fetchUser();
      await fetchServices();
      setIsLoading(false);
    };

    init();
  }, []);

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
      <AddServiceModal open={showAddService} onClose={() => setShowAddService(false)} />

      {/* Sidebar */}
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-white">Media Basket</h1>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
