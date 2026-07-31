"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Trash2, Edit3 } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  parent_id: string | null;
  user_name: string;
  user_email: string;
  created_at: string;
}

interface Props {
  contentItemId: string;
  orgId: string;
}

export default function InternalComments({ contentItemId, orgId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    fetchComments();
  }, [contentItemId]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setComments(await res.json());
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newComment.trim()) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/comments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ body: newComment }),
        }
      );
      if (res.ok) {
        setNewComment("");
        await fetchComments();
      }
    } catch {}
  };

  const handleUpdate = async (id: string) => {
    if (!editBody.trim()) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/comments/${id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ body: editBody }),
        }
      );
      if (res.ok) {
        setEditingId(null);
        await fetchComments();
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/comments/${id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) await fetchComments();
    } catch {}
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-white">Internal Comments</span>
        <span className="text-xs text-gray-400">({comments.length})</span>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : comments.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No comments yet</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {comments.map((c) => (
              <div key={c.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingId === c.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="flex-1 px-2 py-1 bg-gray-700 text-white text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(c.id)}
                        />
                        <button onClick={() => handleUpdate(c.id)} className="text-green-400 text-xs hover:underline">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white">{c.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {c.user_name} &middot; {formatDate(c.created_at)}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== c.id && (
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                        className="p-1 text-gray-400 hover:text-blue-400"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-400 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!newComment.trim()}
            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
