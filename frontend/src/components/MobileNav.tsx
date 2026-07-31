"use client";

import { useState } from "react";
import { Menu, X, Search, Plus, LogOut, ChevronLeft } from "lucide-react";

interface Props {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onAddService: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function MobileNav({
  onToggleSidebar,
  sidebarOpen,
  onAddService,
  onLogout,
  searchQuery,
  onSearchChange,
}: Props) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-800 border-b border-gray-700 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-bold text-white">Media Basket</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAddService}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-600 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
