"use client";

import { decodeJwtPayload } from "../../lib/jwt";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import {
  ArrowLeft,
  Play,
  Pause,
  Plus,
  Trash2,
  ChevronRight,
  Zap,
  GitBranch,
  Clock,
  Bell,
  Shield,
  Send,
  RefreshCw,
  Eye,
  Copy,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Workflow,
  Pencil,
  CopyPlus,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface WorkflowStep {
  id: string;
  type: "condition" | "action" | "delay" | "branch";
  config: Record<string, any>;
  next?: string;
  branches?: Record<string, string>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  enabled: boolean;
  run_count: number;
  last_run_status: string | null;
  last_run_at: string | null;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger_type: string;
  steps: WorkflowStep[];
}

interface Execution {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  step_results: Record<string, any>;
  error: string | null;
  triggered_by: string;
}

const TRIGGER_TYPES = [
  { value: "content.new", label: "New Content" },
  { value: "content.flagged", label: "Content Flagged" },
  { value: "schedule", label: "Schedule" },
  { value: "webhook", label: "Webhook" },
  { value: "manual", label: "Manual" },
];

const STEP_TYPES = [
  { value: "condition", label: "Condition", icon: Shield, color: "text-yellow-400" },
  { value: "action", label: "Action", icon: Zap, color: "text-blue-400" },
  { value: "delay", label: "Delay", icon: Clock, color: "text-purple-400" },
  { value: "branch", label: "Branch", icon: GitBranch, color: "text-green-400" },
];

const ACTION_TYPES = [
  { value: "notify", label: "Send Notification", icon: Bell },
  { value: "flag_content", label: "Flag Content", icon: Shield },
  { value: "update_status", label: "Update Status", icon: Pencil },
  { value: "send_webhook", label: "Send Webhook", icon: Send },
  { value: "log", label: "Log Message", icon: Eye },
];

const TEMPLATE_ICONS: Record<string, any> = {
  Shield: Shield,
  Bell: Bell,
  Zap: Zap,
  GitBranch: GitBranch,
  Clock: Clock,
  Send: Send,
};

const DEFAULT_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tpl_auto_moderate",
    name: "Auto-Moderate Content",
    description: "Automatically flag and review new content based on sentiment analysis",
    icon: "Shield",
    trigger_type: "content.new",
    steps: [
      { id: "s1", type: "condition", config: { field: "metadata.sentiment", operator: "equals", value: "negative" } },
      { id: "s2", type: "action", config: { action_type: "flag_content", reason: "Auto-flagged: negative sentiment" } },
      { id: "s3", type: "action", config: { action_type: "notify", channel: "moderation", message: "Negative content detected" } },
    ],
  },
  {
    id: "tpl_alert_team",
    name: "Alert on Flagged",
    description: "Send team notification when content is flagged for review",
    icon: "Bell",
    trigger_type: "content.flagged",
    steps: [
      { id: "s1", type: "action", config: { action_type: "notify", channel: "team", message: "Content flagged for review" } },
      { id: "s2", type: "delay", config: { seconds: 300 } },
      { id: "s3", type: "action", config: { action_type: "log", level: "info", message: "Alert sent" } },
    ],
  },
  {
    id: "tpl_webhook_forward",
    name: "Webhook Forwarder",
    description: "Forward content to external webhook on new ingestion",
    icon: "Send",
    trigger_type: "content.new",
    steps: [
      { id: "s1", type: "action", config: { action_type: "send_webhook", url: "https://example.com/hook", method: "POST" } },
    ],
  },
  {
    id: "tpl_smart_route",
    name: "Smart Content Router",
    description: "Route content to different handlers based on type and source",
    icon: "GitBranch",
    trigger_type: "content.new",
    steps: [
      { id: "s1", type: "branch", config: { field: "content_type" }, branches: { video: "s2", text: "s3", image: "s4" } },
      { id: "s2", type: "action", config: { action_type: "update_status", status: "pending_review" } },
      { id: "s3", type: "action", config: { action_type: "log", level: "info", message: "Text content processed" } },
      { id: "s4", type: "action", config: { action_type: "update_status", status: "approved" } },
    ],
  },
  {
    id: "tpl_delayed_review",
    name: "Delayed Review",
    description: "Wait before processing content for manual review window",
    icon: "Clock",
    trigger_type: "content.new",
    steps: [
      { id: "s1", type: "delay", config: { seconds: 3600 } },
      { id: "s2", type: "condition", config: { field: "status", operator: "equals", value: "pending" } },
      { id: "s3", type: "action", config: { action_type: "update_status", status: "auto_approved" } },
    ],
  },
  {
    id: "tpl_health_check",
    name: "Scheduled Health Check",
    description: "Run periodic system health checks and alert on issues",
    icon: "Zap",
    trigger_type: "schedule",
    steps: [
      { id: "s1", type: "action", config: { action_type: "log", level: "info", message: "Health check started" } },
      { id: "s2", type: "condition", config: { field: "system.status", operator: "not_equals", value: "healthy" } },
      { id: "s3", type: "action", config: { action_type: "notify", channel: "ops", message: "System health degraded" } },
    ],
  },
];

function getOrgId(): string | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const payload = decodeJwtPayload(token);
    return payload.org_id;
  } catch {
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderTriggerType, setBuilderTriggerType] = useState("content.new");
  const [builderSteps, setBuilderSteps] = useState<WorkflowStep[]>([]);
  const [showStepTypeSelector, setShowStepTypeSelector] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) { router.push("/login"); return; }
    setLoading(true);
    setError(null);
    try {
      const [wfRes, tplRes] = await Promise.all([
        fetch(`${API_BASE}/orgs/${orgId}/workflows`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/orgs/${orgId}/workflows/templates/list`, { headers: getAuthHeaders() }),
      ]);
      if (wfRes.ok) {
        const data = await wfRes.json();
        setWorkflows(Array.isArray(data) ? data : []);
      }
      if (tplRes.ok) {
        const data = await tplRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setTemplates(data);
        }
      }
    } catch {
      setError("Failed to load workflows");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    loadData();
  }, [loadData]);

  const loadExecutions = async (workflowId: string) => {
    const orgId = getOrgId();
    if (!orgId) return;
    setLoadingExecutions(true);
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/workflows/${workflowId}/executions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setExecutions(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoadingExecutions(false);
  };

  const handleSelectWorkflow = async (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setExecutions([]);
    await loadExecutions(wf.id);
  };

  const handleExecute = async (id: string) => {
    const orgId = getOrgId();
    if (!orgId) return;
    setExecutingId(id);
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/workflows/${id}/execute`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_by: "manual" }),
      });
      if (res.ok) {
        await loadData();
        if (selectedWorkflow?.id === id) {
          await loadExecutions(id);
        }
      }
    } catch {}
    setExecutingId(null);
  };

  const handleToggle = async (id: string) => {
    const orgId = getOrgId();
    if (!orgId) return;
    setTogglingId(id);
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/workflows/${id}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {}
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    const orgId = getOrgId();
    if (!orgId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/workflows/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        if (selectedWorkflow?.id === id) {
          setSelectedWorkflow(null);
          setExecutions([]);
        }
        await loadData();
      }
    } catch {}
    setDeletingId(null);
    setShowDeleteConfirm(null);
  };

  const openBuilderFromTemplate = (template: WorkflowTemplate) => {
    setEditingWorkflow(null);
    setBuilderName(template.name);
    setBuilderDescription(template.description);
    setBuilderTriggerType(template.trigger_type);
    setBuilderSteps(template.steps.map((s) => ({ ...s, id: generateStepId() })));
    setShowBuilder(true);
    setBuilderError(null);
  };

  const openBuilderForEdit = (wf: Workflow) => {
    setEditingWorkflow(wf);
    setBuilderName(wf.name);
    setBuilderDescription(wf.description);
    setBuilderTriggerType(wf.trigger_type);
    setBuilderSteps(JSON.parse(JSON.stringify(wf.steps)));
    setShowBuilder(true);
    setBuilderError(null);
  };

  const openBuilderNew = () => {
    setEditingWorkflow(null);
    setBuilderName("");
    setBuilderDescription("");
    setBuilderTriggerType("content.new");
    setBuilderSteps([]);
    setShowBuilder(true);
    setBuilderError(null);
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setEditingWorkflow(null);
    setBuilderError(null);
    setEditingStepId(null);
  };

  const addStep = (type: WorkflowStep["type"]) => {
    const newStep: WorkflowStep = {
      id: generateStepId(),
      type,
      config: getDefaultConfig(type),
    };
    setBuilderSteps((prev) => [...prev, newStep]);
    setShowStepTypeSelector(false);
    setEditingStepId(newStep.id);
  };

  const getDefaultConfig = (type: WorkflowStep["type"]): Record<string, any> => {
    switch (type) {
      case "condition":
        return { field: "", operator: "equals", value: "" };
      case "action":
        return { action_type: "notify", channel: "", message: "" };
      case "delay":
        return { seconds: 60 };
      case "branch":
        return { field: "" };
      default:
        return {};
    }
  };

  const updateStepConfig = (stepId: string, config: Record<string, any>) => {
    setBuilderSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, config } : s))
    );
  };

  const updateStepBranches = (stepId: string, branches: Record<string, string>) => {
    setBuilderSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, branches } : s))
    );
  };

  const removeStep = (stepId: string) => {
    setBuilderSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (editingStepId === stepId) setEditingStepId(null);
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    setBuilderSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleSaveWorkflow = async () => {
    const orgId = getOrgId();
    if (!orgId) return;
    if (!builderName.trim()) {
      setBuilderError("Workflow name is required");
      return;
    }
    if (builderSteps.length === 0) {
      setBuilderError("At least one step is required");
      return;
    }
    setBuilderError(null);
    const body = {
      name: builderName.trim(),
      description: builderDescription.trim(),
      trigger_type: builderTriggerType,
      steps: builderSteps,
    };
    try {
      const url = editingWorkflow
        ? `${API_BASE}/orgs/${orgId}/workflows/${editingWorkflow.id}`
        : `${API_BASE}/orgs/${orgId}/workflows`;
      const method = editingWorkflow ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        closeBuilder();
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setBuilderError(data.detail || "Failed to save workflow");
      }
    } catch {
      setBuilderError("Failed to save workflow");
    }
  };

  const handleDuplicate = async (wf: Workflow) => {
    const orgId = getOrgId();
    if (!orgId) return;
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/workflows`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${wf.name} (Copy)`,
          description: wf.description,
          trigger_type: wf.trigger_type,
          steps: JSON.parse(JSON.stringify(wf.steps)),
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {}
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "success":
        return "text-green-400";
      case "failed":
      case "error":
        return "text-red-400";
      case "running":
        return "text-yellow-400";
      case "pending":
        return "text-gray-400";
      default:
        return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const getStepIcon = (type: string) => {
    const found = STEP_TYPES.find((st) => st.value === type);
    return found ? found.icon : Zap;
  };

  const getStepColor = (type: string) => {
    const found = STEP_TYPES.find((st) => st.value === type);
    return found ? found.color : "text-gray-400";
  };

  const renderStepConfig = (step: WorkflowStep) => {
    switch (step.type) {
      case "condition":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Field</label>
              <input
                type="text"
                value={step.config.field || ""}
                onChange={(e) => updateStepConfig(step.id, { ...step.config, field: e.target.value })}
                placeholder="e.g. metadata.sentiment"
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Operator</label>
              <select
                value={step.config.operator || "equals"}
                onChange={(e) => updateStepConfig(step.id, { ...step.config, operator: e.target.value })}
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="gt">Greater Than</option>
                <option value="lt">Less Than</option>
                <option value="exists">Exists</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Value</label>
              <input
                type="text"
                value={step.config.value || ""}
                onChange={(e) => updateStepConfig(step.id, { ...step.config, value: e.target.value })}
                placeholder="Value to compare"
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        );
      case "action":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Action Type</label>
              <select
                value={step.config.action_type || "notify"}
                onChange={(e) => {
                  const actionType = e.target.value;
                  const baseConfig: Record<string, any> = { action_type: actionType };
                  if (actionType === "notify") {
                    baseConfig.channel = step.config.channel || "";
                    baseConfig.message = step.config.message || "";
                  } else if (actionType === "flag_content") {
                    baseConfig.reason = step.config.reason || "";
                  } else if (actionType === "update_status") {
                    baseConfig.status = step.config.status || "";
                  } else if (actionType === "send_webhook") {
                    baseConfig.url = step.config.url || "";
                    baseConfig.method = step.config.method || "POST";
                  } else if (actionType === "log") {
                    baseConfig.level = step.config.level || "info";
                    baseConfig.message = step.config.message || "";
                  }
                  updateStepConfig(step.id, baseConfig);
                }}
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
            </div>
            {step.config.action_type === "notify" && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Channel</label>
                  <input
                    type="text"
                    value={step.config.channel || ""}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, channel: e.target.value })}
                    placeholder="e.g. team, moderation, ops"
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Message</label>
                  <input
                    type="text"
                    value={step.config.message || ""}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, message: e.target.value })}
                    placeholder="Notification message"
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            {step.config.action_type === "flag_content" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={step.config.reason || ""}
                  onChange={(e) => updateStepConfig(step.id, { ...step.config, reason: e.target.value })}
                  placeholder="Flag reason"
                  className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            {step.config.action_type === "update_status" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">New Status</label>
                <input
                  type="text"
                  value={step.config.status || ""}
                  onChange={(e) => updateStepConfig(step.id, { ...step.config, status: e.target.value })}
                  placeholder="e.g. approved, pending_review"
                  className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            {step.config.action_type === "send_webhook" && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">URL</label>
                  <input
                    type="text"
                    value={step.config.url || ""}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, url: e.target.value })}
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Method</label>
                  <select
                    value={step.config.method || "POST"}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, method: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              </>
            )}
            {step.config.action_type === "log" && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Level</label>
                  <select
                    value={step.config.level || "info"}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, level: e.target.value })}
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Message</label>
                  <input
                    type="text"
                    value={step.config.message || ""}
                    onChange={(e) => updateStepConfig(step.id, { ...step.config, message: e.target.value })}
                    placeholder="Log message"
                    className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        );
      case "delay":
        return (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Delay (seconds)</label>
            <input
              type="number"
              min={1}
              value={step.config.seconds || 60}
              onChange={(e) => updateStepConfig(step.id, { ...step.config, seconds: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {step.config.seconds ? `${Math.floor(step.config.seconds / 60)}m ${step.config.seconds % 60}s` : "60s"}
            </p>
          </div>
        );
      case "branch":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Branch Field</label>
              <input
                type="text"
                value={step.config.field || ""}
                onChange={(e) => updateStepConfig(step.id, { ...step.config, field: e.target.value })}
                placeholder="e.g. content_type"
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Branches (key: step_id)</label>
              <div className="space-y-2">
                {Object.entries(step.branches || {}).map(([key, targetStepId]) => (
                  <div key={key} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={key}
                      readOnly
                      className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-400"
                    />
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                    <input
                      type="text"
                      value={targetStepId}
                      readOnly
                      className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-400"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const key = prompt("Branch key (e.g. video, text):");
                    if (key && key.trim()) {
                      const branches = { ...(step.branches || {}), [key.trim()]: "" };
                      updateStepBranches(step.id, branches);
                    }
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Add branch
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/tree")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Workflow className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold">Workflow Automation</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 hover:bg-gray-800 rounded-lg" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
            <ThemeToggle />
            <button
              onClick={openBuilderNew}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Workflow
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Template Gallery */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CopyPlus className="w-5 h-5 text-gray-400" />
            Template Gallery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              const IconComp = TEMPLATE_ICONS[tpl.icon] || Zap;
              return (
                <div key={tpl.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition group">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-purple-900/40 rounded-lg group-hover:bg-purple-900/60 transition">
                      <IconComp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-white truncate">{tpl.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{tpl.steps.length} steps</span>
                    <button
                      onClick={() => openBuilderFromTemplate(tpl)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition"
                    >
                      Use Template
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main Content Area */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Workflow List */}
          <div className={selectedWorkflow ? "lg:col-span-2" : "lg:col-span-3"}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-gray-400" />
              Your Workflows
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : workflows.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
                <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No workflows yet. Create one from a template or build from scratch.</p>
                <button
                  onClick={openBuilderNew}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Workflow
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className={`bg-gray-800 rounded-xl p-4 border transition cursor-pointer ${
                      selectedWorkflow?.id === wf.id ? "border-purple-500" : "border-gray-700 hover:border-gray-600"
                    }`}
                    onClick={() => handleSelectWorkflow(wf)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-sm text-white truncate">{wf.name}</h3>
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
                            {TRIGGER_TYPES.find((t) => t.value === wf.trigger_type)?.label || wf.trigger_type}
                          </span>
                          {wf.enabled ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-400">Active</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-500">Disabled</span>
                          )}
                        </div>
                        {wf.description && (
                          <p className="text-xs text-gray-400 truncate mb-1">{wf.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{wf.steps.length} steps</span>
                          <span>{wf.run_count} runs</span>
                          {wf.last_run_status && (
                            <span className={`flex items-center gap-1 ${getStatusColor(wf.last_run_status)}`}>
                              {getStatusIcon(wf.last_run_status)}
                              {wf.last_run_status}
                            </span>
                          )}
                          {wf.last_run_at && <span>Last: {formatTime(wf.last_run_at)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggle(wf.id)}
                          disabled={togglingId === wf.id}
                          title={wf.enabled ? "Disable" : "Enable"}
                          className="p-1.5 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                        >
                          {wf.enabled ? (
                            <Pause className="w-4 h-4 text-yellow-400" />
                          ) : (
                            <Play className="w-4 h-4 text-green-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleExecute(wf.id)}
                          disabled={executingId === wf.id}
                          title="Execute now"
                          className="p-1.5 hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                        >
                          {executingId === wf.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          ) : (
                            <Play className="w-4 h-4 text-blue-400" />
                          )}
                        </button>
                        <button
                          onClick={() => openBuilderForEdit(wf)}
                          title="Edit"
                          className="p-1.5 hover:bg-gray-700 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(wf)}
                          title="Duplicate"
                          className="p-1.5 hover:bg-gray-700 rounded-lg transition"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                        {showDeleteConfirm === wf.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(wf.id)}
                              disabled={deletingId === wf.id}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === wf.id ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(wf.id)}
                            title="Delete"
                            className="p-1.5 hover:bg-gray-700 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execution History Panel */}
          {selectedWorkflow && (
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-xl border border-gray-700 sticky top-8">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm text-white truncate">{selectedWorkflow.name}</h3>
                    <button
                      onClick={() => { setSelectedWorkflow(null); setExecutions([]); }}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Execution History</p>
                </div>
                <div className="p-4">
                  {loadingExecutions ? (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : executions.length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No executions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {executions.map((ex) => (
                        <div key={ex.id} className="bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(ex.status)}
                              <span className={`text-xs font-medium capitalize ${getStatusColor(ex.status)}`}>
                                {ex.status}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">{ex.triggered_by}</span>
                          </div>
                          <p className="text-xs text-gray-400">{formatTime(ex.started_at)}</p>
                          {ex.completed_at && (
                            <p className="text-xs text-gray-500">
                              Completed: {formatTime(ex.completed_at)}
                            </p>
                          )}
                          {ex.error && (
                            <p className="text-xs text-red-400 mt-1 truncate">{ex.error}</p>
                          )}
                          {ex.step_results && Object.keys(ex.step_results).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(ex.step_results).map(([stepId, result]) => (
                                <div key={stepId} className="flex items-center gap-2 text-xs">
                                  <span className="text-gray-500 font-mono truncate">{stepId}</span>
                                  <span className={`${
                                    (result as any)?.status === "success" ? "text-green-400" :
                                    (result as any)?.status === "failed" ? "text-red-400" :
                                    "text-gray-400"
                                  }`}>
                                    {(result as any)?.status || "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={closeBuilder}>
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Builder Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {editingWorkflow ? "Edit Workflow" : "Create Workflow"}
              </h2>
              <button onClick={closeBuilder} className="p-1 hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {builderError && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {builderError}
                </div>
              )}

              {/* Name & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                    placeholder="My Workflow"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={builderDescription}
                    onChange={(e) => setBuilderDescription(e.target.value)}
                    placeholder="What does this workflow do?"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trigger Type</label>
                  <select
                    value={builderTriggerType}
                    onChange={(e) => setBuilderTriggerType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {TRIGGER_TYPES.map((tt) => (
                      <option key={tt.value} value={tt.value}>{tt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Steps Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Steps</h3>
                  <button
                    onClick={() => setShowStepTypeSelector(!showStepTypeSelector)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-medium transition"
                  >
                    <Plus className="w-3 h-3" />
                    Add Step
                  </button>
                </div>

                {/* Step Type Selector */}
                {showStepTypeSelector && (
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-xs text-gray-400 mb-2">Select step type:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STEP_TYPES.map((st) => {
                        const Icon = st.icon;
                        return (
                          <button
                            key={st.value}
                            onClick={() => addStep(st.value as WorkflowStep["type"])}
                            className="flex flex-col items-center gap-1 p-3 bg-gray-800 hover:bg-gray-600 rounded-lg transition"
                          >
                            <Icon className={`w-5 h-5 ${st.color}`} />
                            <span className="text-xs text-gray-300">{st.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Visual Flow */}
                {builderSteps.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-gray-700 rounded-xl">
                    <GitBranch className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No steps added yet</p>
                    <p className="text-xs text-gray-500 mt-1">Click "Add Step" to build your workflow</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {builderSteps.map((step, idx) => {
                      const StepIcon = getStepIcon(step.type);
                      const isEditing = editingStepId === step.id;
                      return (
                        <div key={step.id}>
                          {/* Connector line */}
                          {idx > 0 && (
                            <div className="flex justify-center">
                              <div className="w-px h-6 bg-purple-500/50" />
                            </div>
                          )}
                          {/* Step card */}
                          <div className={`bg-gray-700/50 rounded-xl border transition ${
                            isEditing ? "border-purple-500" : "border-gray-600"
                          }`}>
                            <div
                              className="flex items-center gap-3 p-3 cursor-pointer"
                              onClick={() => setEditingStepId(isEditing ? null : step.id)}
                            >
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, "up"); }}
                                  disabled={idx === 0}
                                  className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 12 12"><path d="M6 2L10 8H2L6 2Z" fill="currentColor"/></svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, "down"); }}
                                  disabled={idx === builderSteps.length - 1}
                                  className="p-0.5 text-gray-500 hover:text-gray-300 disabled:opacity-30"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 12 12"><path d="M6 10L2 4H10L6 10Z" fill="currentColor"/></svg>
                                </button>
                              </div>
                              <StepIcon className={`w-4 h-4 shrink-0 ${getStepColor(step.type)}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-400 capitalize">{step.type}</span>
                                {step.type === "action" && step.config.action_type && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({ACTION_TYPES.find((a) => a.value === step.config.action_type)?.label || step.config.action_type})
                                  </span>
                                )}
                                {step.type === "delay" && step.config.seconds && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({step.config.seconds}s)
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                                className="p-1 hover:bg-gray-600 rounded transition shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                              </button>
                              <ChevronRight className={`w-4 h-4 text-gray-500 transition shrink-0 ${isEditing ? "rotate-90" : ""}`} />
                            </div>
                            {/* Step Config */}
                            {isEditing && (
                              <div className="px-3 pb-3 pt-1 border-t border-gray-600">
                                {renderStepConfig(step)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Builder Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
              <button
                onClick={closeBuilder}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWorkflow}
                disabled={!builderName.trim() || builderSteps.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                {editingWorkflow ? (
                  <>
                    <Pencil className="w-4 h-4" />
                    Update Workflow
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Workflow
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

