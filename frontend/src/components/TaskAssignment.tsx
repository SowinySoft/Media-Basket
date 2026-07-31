"use client";

import { useState, useEffect } from "react";
import { ClipboardList, UserPlus, Trash2, Edit3, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Task {
  id: string;
  content_item_id: string;
  content_type: string;
  content_preview: string;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  orgId: string;
  contentItemId?: string;
  onAssign?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400 bg-gray-700",
  medium: "text-yellow-400 bg-yellow-900/30",
  high: "text-orange-400 bg-orange-900/30",
  urgent: "text-red-400 bg-red-900/30",
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  in_progress: AlertCircle,
  done: CheckCircle,
};

export default function TaskAssignment({ orgId, contentItemId, onAssign }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [orgId, filter]);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (filter) params.append("status", filter);
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/tasks?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setTasks(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/tasks/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setMembers(await res.json());
    } catch {}
  };

  const handleAssign = async () => {
    if (!contentItemId) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content_item_id: contentItemId,
          assigned_to: selectedMember || null,
          priority,
          notes,
        }),
      });
      if (res.ok) {
        setShowAssign(false);
        setSelectedMember("");
        setNotes("");
        await fetchTasks();
        onAssign?.();
      }
    } catch {}
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/tasks/${taskId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchTasks();
    } catch {}
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTasks();
    } catch {}
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Tasks</span>
          <span className="text-xs text-gray-400">({tasks.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          {contentItemId && (
            <button
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="w-3 h-3" />
              Assign
            </button>
          )}
        </div>
      </div>

      {/* Assign modal */}
      {showAssign && (
        <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 space-y-2">
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleAssign} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Assign
            </button>
            <button onClick={() => setShowAssign(false)} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No tasks</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {tasks.map((t) => {
              const StatusIcon = STATUS_ICONS[t.status] || Clock;
              return (
                <div key={t.id} className="px-4 py-3 hover:bg-gray-750">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 ${
                          t.status === "done" ? "text-green-400" : t.status === "in_progress" ? "text-yellow-400" : "text-gray-400"
                        }`} />
                        <span className="text-sm text-white truncate">{t.content_preview || t.content_type}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-6">
                        <span className={`px-2 py-0.5 text-xs rounded ${PRIORITY_COLORS[t.priority]}`}>
                          {t.priority}
                        </span>
                        {t.assignee_name && (
                          <span className="text-xs text-gray-400">{t.assignee_name}</span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {t.status !== "done" && (
                        <button
                          onClick={() => handleStatusChange(t.id, t.status === "pending" ? "in_progress" : "done")}
                          className="p-1 text-gray-400 hover:text-green-400"
                          title={t.status === "pending" ? "Start" : "Complete"}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
