"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Users, UserPlus, Trash2, Shield, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Member {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_email: string;
  user_name: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-900/50 text-purple-400",
  admin: "bg-blue-900/50 text-blue-400",
  member: "bg-green-900/50 text-green-400",
  viewer: "bg-gray-700 text-gray-400",
};

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    const payload = JSON.parse(atob(token.split(".")[1]));
    setCurrentUserRole(payload.role);
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const token = localStorage.getItem("access_token");
    const orgId = JSON.parse(atob(token!.split(".")[1])).org_id;
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleInvite = async () => {
    setInviting(true);
    setError("");
    const token = localStorage.getItem("access_token");
    const orgId = JSON.parse(atob(token!.split(".")[1])).org_id;
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        setShowInvite(false);
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to invite");
      }
    } catch {
      setError("Failed to invite member");
    }
    setInviting(false);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const token = localStorage.getItem("access_token");
    const orgId = JSON.parse(atob(token!.split(".")[1])).org_id;
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${memberId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) await fetchMembers();
    } catch {}
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this member?")) return;
    const token = localStorage.getItem("access_token");
    const orgId = JSON.parse(atob(token!.split(".")[1])).org_id;
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await fetchMembers();
    } catch {}
  };

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Users className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Team Members</h1>
          </div>
          <ThemeToggle />
        </div>

        {canManage && (
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4" />
              Invite Member
            </button>
          </div>
        )}

        {showInvite && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
            <h3 className="font-medium mb-3">Invite by Email</h3>
            <p className="text-sm text-gray-400 mb-3">The user must have an account first. They can sign up at /login.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? "Inviting..." : "Send Invite"}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {(member.user_name || member.user_email || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{member.user_name || "Unknown"}</p>
                    <p className="text-sm text-gray-400">{member.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${ROLE_COLORS[member.role] || ""}`}>
                    <Shield className="w-3 h-3 inline mr-1" />
                    {member.role}
                  </span>
                  {canManage && member.role !== "owner" && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="p-1.5 hover:bg-gray-700 rounded text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
