"use client";

import { useState, useEffect } from "react";
import { Activity, MessageSquare, Flag, Trash2, CheckCircle, User } from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  user_name: string;
  user_email: string;
  created_at: string;
}

interface Props {
  orgId: string;
}

const ACTION_ICONS: Record<string, any> = {
  approve: CheckCircle,
  flag: Flag,
  delete: Trash2,
  comment: MessageSquare,
  create: Activity,
  sync: Activity,
};

const ACTION_COLORS: Record<string, string> = {
  approve: "text-green-400",
  flag: "text-yellow-400",
  delete: "text-red-400",
  comment: "text-blue-400",
  create: "text-purple-400",
  sync: "text-cyan-400",
};

export default function ActivityFeed({ orgId }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetchActivity();
  }, [orgId, filter]);

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (filter) params.append("action_type", filter);
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/activity?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setActivities(await res.json());
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Activity Feed</span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
        >
          <option value="">All</option>
          <option value="approve">Approved</option>
          <option value="flag">Flagged</option>
          <option value="delete">Deleted</option>
          <option value="comment">Comments</option>
          <option value="create">Created</option>
          <option value="sync">Synced</option>
        </select>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No activity yet</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {activities.map((a) => {
              const Icon = ACTION_ICONS[a.action] || Activity;
              const color = ACTION_COLORS[a.action] || "text-gray-400";
              return (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-750">
                  <div className={`mt-0.5 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{a.user_name}</span>{" "}
                      <span className="text-gray-400">{a.action}</span>{" "}
                      <span className="text-gray-400">{a.entity_type}</span>
                    </p>
                    {a.details && Object.keys(a.details).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {JSON.stringify(a.details)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{formatTime(a.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
