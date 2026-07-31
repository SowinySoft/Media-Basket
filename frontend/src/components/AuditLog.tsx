"use client";

import { useState, useEffect } from "react";
import { History, Filter } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_name: string;
  user_email: string;
  timestamp: string;
}

interface Props {
  orgId: string;
}

const ACTION_COLORS: Record<string, string> = {
  approve: "text-green-400",
  reject: "text-red-400",
  delete: "text-red-400",
  flag: "text-yellow-400",
  create: "text-blue-400",
  update: "text-cyan-400",
  sync: "text-purple-400",
  login: "text-green-400",
  logout: "text-gray-400",
};

export default function AuditLog({ orgId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [days, setDays] = useState(30);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchEntries();
    fetchFilters();
  }, [orgId, actionFilter, resourceFilter, days]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (actionFilter) params.append("action", actionFilter);
      if (resourceFilter) params.append("resource_type", resourceFilter);
      params.append("days", String(days));
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/audit?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setEntries(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const [actionsRes, resourcesRes] = await Promise.all([
        fetch(`http://localhost:8000/api/v1/orgs/${orgId}/audit/actions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:8000/api/v1/orgs/${orgId}/audit/resources`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (actionsRes.ok) setActionTypes(await actionsRes.json());
      if (resourcesRes.ok) setResourceTypes(await resourcesRes.json());
    } catch {}
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Audit Log</span>
          <span className="text-xs text-gray-400">({entries.length})</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
        >
          <option value="">All Actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
        >
          <option value="">All Resources</option>
          {resourceTypes.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Log entries */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No audit entries</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${ACTION_COLORS[e.action] || "text-gray-300"}`}>
                        {e.action}
                      </span>
                      <span className="text-sm text-gray-400">{e.resource_type}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white">{e.user_name}</span>
                      {e.ip_address && (
                        <span className="text-xs text-gray-500">from {e.ip_address}</span>
                      )}
                    </div>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {JSON.stringify(e.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
