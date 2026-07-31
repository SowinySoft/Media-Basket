"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Trash2, RefreshCw, Eye, Copy, ExternalLink, Flag, CheckCircle } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  node: any;
  onClose: () => void;
  onAction: (action: string, node: any) => void;
}

export default function TreeContextMenu({ x, y, node, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isService = node?.type === "service";
  const isContent = node?.type === "content";

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const serviceItems = [
    { icon: RefreshCw, label: "Sync Now", action: "sync" },
    { icon: Eye, label: "View Content", action: "view_content" },
    { icon: ExternalLink, label: "Open Settings", action: "open_settings" },
    { icon: Trash2, label: "Disconnect", action: "disconnect", danger: true },
  ];

  const contentItems = [
    { icon: Eye, label: "View Details", action: "view" },
    { icon: Copy, label: "Copy ID", action: "copy_id" },
    { icon: CheckCircle, label: "Approve", action: "approve" },
    { icon: Flag, label: "Flag", action: "flag" },
    { icon: Trash2, label: "Delete", action: "delete", danger: true },
  ];

  const items = isService ? serviceItems : isContent ? contentItems : [];

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
        {node?.name || "Node"}
      </div>
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => { onAction(item.action, node); onClose(); }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition ${
            item.danger ? "text-red-400 hover:text-red-300" : "text-gray-200"
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
