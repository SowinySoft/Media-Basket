"use client";

import { usePathname, useRouter } from "next/navigation";
import { Trees, LayoutDashboard, Inbox, Settings } from "lucide-react";

interface Props {
  unreadCount?: number;
}

const tabs = [
  { label: "Home", icon: Trees, href: "/tree" },
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Inbox", icon: Inbox, href: "/inbox" },
  { label: "Settings", icon: Settings, href: "/settings" },
] as const;

export default function BottomNav({ unreadCount = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-800 border-t border-gray-700 pb-safe">
      <div className="flex items-center justify-around">
        {tabs.map(({ label, icon: Icon, href }) => {
          const isActive =
            href === "/tree"
              ? pathname === href || pathname.startsWith(href)
              : pathname.startsWith(href);

          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 ${
                isActive ? "text-blue-500" : "text-gray-400"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {label === "Inbox" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
