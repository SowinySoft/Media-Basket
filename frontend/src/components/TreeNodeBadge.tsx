"use client";

interface TreeNodeBadgeProps {
  count?: number;
  type?: "notification" | "unread" | "flagged";
  className?: string;
}

export default function TreeNodeBadge({ count, type = "notification", className = "" }: TreeNodeBadgeProps) {
  if (!count || count <= 0) return null;

  const colors = {
    notification: "bg-blue-500",
    unread: "bg-green-500",
    flagged: "bg-red-500",
  };

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${colors[type]} ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
