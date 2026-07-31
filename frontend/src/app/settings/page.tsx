"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Building2, Save, Trash2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function OrgSettingsPage() {
  const router = useRouter();
  const { user, org } = useStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    if (org) setName(org.name);
  }, [org]);

  useEffect(() => {
    if (!org) return;
    const fetchOrg = async () => {
      const token = localStorage.getItem("access_token");
      try {
        const res = await fetch(`${API_BASE}/orgs/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setName(data.name);
        }
      } catch {}
    };
    fetchOrg();
  }, [org]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE}/orgs/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setMessage("Organization updated successfully");
      } else {
        const data = await res.json();
        setMessage(data.detail || "Failed to update");
      }
    } catch {
      setMessage("Failed to update organization");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE}/orgs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        router.push("/login");
      }
    } catch {}
    setDeleting(false);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Building2 className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Organization Settings</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">General</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plan</label>
                <p className="text-white">{org?.plan || "free"}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Organization ID</label>
                <p className="text-gray-500 text-sm font-mono">{org?.id}</p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.includes("success") ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
              {message}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <div className="bg-gray-800 rounded-xl p-6 border border-red-900/50">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
            <p className="text-gray-400 text-sm mb-4">
              Deleting your organization will permanently remove all services, content, members, and data. This cannot be undone.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-600 text-red-400 rounded-lg hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4" />
                Delete Organization
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, Delete Everything"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
