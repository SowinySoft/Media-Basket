"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Plus, Trash2, GripVertical, Star, StarOff, Edit3 } from "lucide-react";

interface Dashboard {
  id: string;
  name: string;
  config: { widgets: Widget[] };
  is_default: boolean;
  created_at: string;
}

interface Widget {
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  config: Record<string, any>;
}

interface Props {
  orgId: string;
  onSelect?: (dashboard: Dashboard) => void;
}

const WIDGET_TYPES = [
  { type: "analytics_summary", title: "Analytics Summary" },
  { type: "recent_content", title: "Recent Content" },
  { type: "sentiment_chart", title: "Sentiment Chart" },
  { type: "connector_status", title: "Connector Status" },
  { type: "activity_feed", title: "Activity Feed" },
  { type: "content_calendar", title: "Content Calendar" },
  { type: "alerts_list", title: "Alerts List" },
  { type: "top_posts", title: "Top Posts" },
];

export default function DashboardBuilder({ orgId, onSelect }: Props) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [widgets, setWidgets] = useState<Widget[]>([]);

  useEffect(() => {
    fetchDashboards();
  }, [orgId]);

  const fetchDashboards = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/dashboards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDashboards(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/dashboards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, config: { widgets } }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName("");
        setWidgets([]);
        await fetchDashboards();
      }
    } catch {}
  };

  const handleSetDefault = async (id: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/dashboards/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      await fetchDashboards();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dashboard?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/dashboards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchDashboards();
    } catch {}
  };

  const addWidget = (type: string, title: string) => {
    const existing = widgets.length;
    setWidgets([
      ...widgets,
      {
        type,
        title,
        position: { x: (existing % 2) * 6, y: Math.floor(existing / 2) * 4 },
        size: { w: 6, h: 4 },
        config: {},
      },
    ]);
  };

  const removeWidget = (index: number) => {
    setWidgets(widgets.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Dashboards</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 space-y-3">
          <input
            type="text"
            placeholder="Dashboard name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <p className="text-xs text-gray-400 mb-2">Add Widgets</p>
            <div className="flex flex-wrap gap-2">
              {WIDGET_TYPES.map((wt) => (
                <button
                  key={wt.type}
                  onClick={() => addWidget(wt.type, wt.title)}
                  className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                >
                  + {wt.title}
                </button>
              ))}
            </div>
          </div>
          {widgets.length > 0 && (
            <div className="space-y-1">
              {widgets.map((w, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 bg-gray-700 rounded text-xs">
                  <span className="text-white">{w.title}</span>
                  <button onClick={() => removeWidget(i)} className="text-gray-400 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Create
            </button>
            <button onClick={() => { setShowCreate(false); setWidgets([]); }} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : dashboards.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No dashboards yet</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {dashboards.map((d) => (
              <div key={d.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-white">{d.name}</p>
                      <p className="text-xs text-gray-400">
                        {d.config?.widgets?.length || 0} widgets
                        {d.is_default && " · Default"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onSelect && (
                      <button onClick={() => onSelect(d)} className="p-1 text-gray-400 hover:text-blue-400" title="Open">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleSetDefault(d.id)}
                      className={`p-1 ${d.is_default ? "text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`}
                      title="Set default"
                    >
                      {d.is_default ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
