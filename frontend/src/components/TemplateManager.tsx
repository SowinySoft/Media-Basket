"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { X, Plus, FileText, Trash2, Edit3, Copy } from "lucide-react";

interface Template {
  id: string;
  name: string;
  content: string;
  variables: Record<string, string> | null;
  category: string | null;
  created_at: string;
}

interface Props {
  onClose: () => void;
  onSelect?: (template: Template) => void;
}

export default function TemplateManager({ onClose, onSelect }: Props) {
  const { user, org } = useStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const orgId = org?.id;

  useEffect(() => {
    fetchTemplates();
  }, [orgId]);

  const fetchTemplates = async () => {
    if (!orgId) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!orgId || !name || !content) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, category: category || null }),
      });
      if (res.ok) {
        await fetchTemplates();
        setIsCreating(false);
        setName("");
        setContent("");
        setCategory("");
      }
    } catch {}
  };

  const handleUpdate = async (id: string) => {
    if (!orgId || !name || !content) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/templates/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, category: category || null }),
      });
      if (res.ok) {
        await fetchTemplates();
        setEditingId(null);
        setName("");
        setContent("");
        setCategory("");
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!orgId || !confirm("Delete this template?")) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchTemplates();
      }
    } catch {}
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.content);
    setCategory(t.category || "");
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setName("");
    setContent("");
    setCategory("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Templates</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsCreating(true); setEditingId(null); setName(""); setContent(""); setCategory(""); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Create / Edit form */}
          {(isCreating || editingId) && (
            <div className="mb-4 p-4 bg-gray-750 border border-gray-600 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="Template name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Template content (use {{variable}} for variables)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <input
                type="text"
                placeholder="Category (optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  {editingId ? "Update" : "Create"}
                </button>
                <button onClick={cancelEdit} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Template list */}
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No templates yet</p>
              <p className="text-sm mt-1">Create your first template to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="p-3 bg-gray-750 border border-gray-600 rounded-lg hover:border-gray-500 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate">{t.name}</h3>
                        {t.category && (
                          <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">{t.category}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.content}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {onSelect && (
                        <button
                          onClick={() => onSelect(t)}
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded"
                          title="Use template"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                        title="Delete"
                      >
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
    </div>
  );
}
