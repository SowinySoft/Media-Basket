"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import TreeView from "@/components/TreeView";
import ContentDetail from "@/components/ContentDetail";
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
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">Media Basket</h1>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
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
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {services.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              <p>No services connected yet.</p>
              <button className="mt-2 flex items-center gap-1 text-blue-600 hover:underline">
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>
          ) : (
            <TreeView />
          )}
        </div>

        <div className="p-4 border-t">
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-900">
        {selectedContentId ? (
          <ContentDetail />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Welcome to Media Basket</h2>
              <p>Select an item from the tree to view details</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
