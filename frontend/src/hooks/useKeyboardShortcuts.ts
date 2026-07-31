"use client";

import { useEffect, useCallback } from "react";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : true;
        const altMatch = shortcut.alt ? e.altKey : true;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { key: "k", ctrl: true, action: () => {}, description: "Quick Search" },
  { key: "n", ctrl: true, action: () => {}, description: "New Post" },
  { key: "s", ctrl: true, shift: true, action: () => {}, description: "Schedule" },
  { key: "Escape", action: () => {}, description: "Close Modal" },
  { key: "/", ctrl: true, action: () => {}, description: "Show Shortcuts" },
];
