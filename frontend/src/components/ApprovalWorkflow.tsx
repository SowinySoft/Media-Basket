"use client";

import { useState, useEffect } from "react";
import { Shield, CheckCircle, XCircle, Clock, Send } from "lucide-react";

interface ApprovalStatus {
  content_item_id: string;
  approval_status: string;
  history: {
    action: string;
    details: Record<string, any> | null;
    user_name: string;
    performed_at: string;
  }[];
}

interface Props {
  contentItemId: string;
  orgId: string;
  onStatusChange?: () => void;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  draft: { icon: Send, color: "text-gray-400", label: "Draft" },
  pending: { icon: Clock, color: "text-yellow-400", label: "Pending Review" },
  approved: { icon: CheckCircle, color: "text-green-400", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-400", label: "Rejected" },
  changes_requested: { icon: Clock, color: "text-orange-400", label: "Changes Requested" },
};

export default function ApprovalWorkflow({ contentItemId, orgId, onStatusChange }: Props) {
  const [status, setStatus] = useState<ApprovalStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [contentItemId]);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/approval`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setStatus(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/approval`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        await fetchStatus();
        onStatusChange?.();
      }
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (action: string, notes?: string) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `http://localhost:8000/api/v1/orgs/${orgId}/content/${contentItemId}/approval/action`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes }),
        }
      );
      if (res.ok) {
        setShowRejectForm(false);
        setRejectNotes("");
        await fetchStatus();
        onStatusChange?.();
      }
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return null;

  const currentStatus = status?.approval_status || "draft";
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.draft;
  const Icon = config.icon;

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Approval</span>
        </div>
        <div className={`flex items-center gap-1 ${config.color}`}>
          <Icon className="w-4 h-4" />
          <span className="text-sm">{config.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-b border-gray-700">
        {currentStatus === "draft" && (
          <button
            onClick={handleSubmitForApproval}
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Submit for Approval
          </button>
        )}

        {currentStatus === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("approve")}
              disabled={isSubmitting}
              className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={isSubmitting}
              className="flex-1 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}

        {(currentStatus === "rejected" || currentStatus === "changes_requested") && (
          <button
            onClick={handleSubmitForApproval}
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Resubmit
          </button>
        )}
      </div>

      {/* Reject form */}
      {showRejectForm && (
        <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 space-y-2">
          <textarea
            placeholder="Reason for rejection..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("reject", rejectNotes)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => handleAction("request_changes", rejectNotes)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {status?.history && status.history.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400 mb-2">History</p>
          <div className="space-y-1">
            {status.history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">
                  {new Date(h.performed_at).toLocaleDateString()}
                </span>
                <span className="text-white">{h.user_name}</span>
                <span className="text-gray-400">{h.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
