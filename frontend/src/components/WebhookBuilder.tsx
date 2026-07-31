"use client";

import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2, Play, CheckCircle, XCircle, GripVertical, Zap, Filter, Send } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  has_secret: boolean;
  created_at: string;
}

interface FlowStep {
  id: string;
  type: "trigger" | "filter" | "transform" | "action";
  config: Record<string, any>;
}

interface Props {
  orgId: string;
}

const AVAILABLE_EVENTS = [
  "content.created",
  "content.flagged",
  "content.approved",
  "content.deleted",
  "alert.triggered",
  "sync.completed",
  "member.joined",
];

const STEP_TYPES = {
  trigger: { icon: Zap, color: "text-yellow-400 bg-yellow-900/30", label: "Trigger" },
  filter: { icon: Filter, color: "text-blue-400 bg-blue-900/30", label: "Filter" },
  transform: { icon: Send, color: "text-purple-400 bg-purple-900/30", label: "Transform" },
  action: { icon: Send, color: "text-green-400 bg-green-900/30", label: "Action" },
};

function SortableStep({ step, onRemove, onUpdate }: { step: FlowStep; onRemove: () => void; onUpdate: (config: Record<string, any>) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeInfo = STEP_TYPES[step.type];
  const Icon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border border-gray-700 ${typeInfo.color}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>
      <Icon className="w-4 h-4" />
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{typeInfo.label}</p>
        {step.type === "trigger" && (
          <select
            value={step.config.event || ""}
            onChange={(e) => onUpdate({ ...step.config, event: e.target.value })}
            className="mt-1 w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
          >
            <option value="">Select event...</option>
            {AVAILABLE_EVENTS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        )}
        {step.type === "filter" && (
          <input
            type="text"
            placeholder="e.g., content.body contains 'important'"
            value={step.config.condition || ""}
            onChange={(e) => onUpdate({ ...step.config, condition: e.target.value })}
            className="mt-1 w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
          />
        )}
        {step.type === "transform" && (
          <input
            type="text"
            placeholder="e.g., Add prefix: [ALERT]"
            value={step.config.template || ""}
            onChange={(e) => onUpdate({ ...step.config, template: e.target.value })}
            className="mt-1 w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
          />
        )}
        {step.type === "action" && (
          <input
            type="url"
            placeholder="Webhook URL"
            value={step.config.url || ""}
            onChange={(e) => onUpdate({ ...step.config, url: e.target.value })}
            className="mt-1 w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
          />
        )}
      </div>
      <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-400">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function WebhookBuilder({ orgId }: Props) {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; error?: string } | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [showFlowEditor, setShowFlowEditor] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchWebhooks();
  }, [orgId]);

  const fetchWebhooks = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWebhooks(await res.json());
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newUrl || newEvents.length === 0) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          events: newEvents,
          secret: newSecret || null,
          flow: flowSteps.length > 0 ? flowSteps : undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewUrl("");
        setNewEvents([]);
        setNewSecret("");
        setFlowSteps([]);
        setShowFlowEditor(false);
        await fetchWebhooks();
      }
    } catch {}
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchWebhooks();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchWebhooks();
    } catch {}
  };

  const handleTest = async (id: string) => {
    setTestResult(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`http://localhost:8000/api/v1/orgs/${orgId}/webhooks/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult({ id, ok: data.ok, error: data.error });
    } catch {
      setTestResult({ id, ok: false, error: "Network error" });
    }
  };

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const addStep = (type: FlowStep["type"]) => {
    setFlowSteps([
      ...flowSteps,
      { id: `step-${Date.now()}`, type, config: {} },
    ]);
  };

  const removeStep = (id: string) => {
    setFlowSteps(flowSteps.filter((s) => s.id !== id));
  };

  const updateStep = (id: string, config: Record<string, any>) => {
    setFlowSteps(flowSteps.map((s) => s.id === id ? { ...s, config } : s));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFlowSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Webhooks</span>
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
            type="url"
            placeholder="Webhook URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <p className="text-xs text-gray-400 mb-1">Events</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`px-2 py-1 text-xs rounded ${
                    newEvents.includes(event)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="Secret (optional, for signature verification)"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Flow Editor Toggle */}
          <button
            onClick={() => setShowFlowEditor(!showFlowEditor)}
            className="text-blue-400 text-xs hover:underline flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            {showFlowEditor ? "Hide Flow Editor" : "Add Flow Logic"}
          </button>

          {/* Visual Flow Editor */}
          {showFlowEditor && (
            <div className="border border-gray-600 rounded-lg p-3 space-y-3">
              <p className="text-xs text-gray-400">Drag steps to reorder. Add filters, transforms, or actions.</p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={flowSteps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {flowSteps.map((step) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        onRemove={() => removeStep(step.id)}
                        onUpdate={(config) => updateStep(step.id, config)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {flowSteps.length === 0 && (
                <p className="text-center text-gray-500 text-xs py-4">No steps added yet</p>
              )}

              {/* Add step buttons */}
              <div className="flex flex-wrap gap-2">
                {(["trigger", "filter", "transform", "action"] as const).map((type) => {
                  const info = STEP_TYPES[type];
                  const Icon = info.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => addStep(type)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
                    >
                      <Icon className="w-3 h-3" />
                      {info.label}
                    </button>
                  );
                })}
              </div>

              {/* Flow preview */}
              {flowSteps.length > 0 && (
                <div className="mt-3 p-2 bg-gray-800 rounded text-xs text-gray-400">
                  <p className="font-medium text-white mb-1">Flow Preview:</p>
                  {flowSteps.map((step, i) => (
                    <span key={step.id}>
                      {STEP_TYPES[step.type].label}
                      {step.config.event && ` (${step.config.event})`}
                      {step.config.condition && ` [${step.config.condition}]`}
                      {i < flowSteps.length - 1 && " → "}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Create
            </button>
            <button onClick={() => { setShowCreate(false); setFlowSteps([]); }} className="px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : webhooks.length === 0 ? (
          <p className="p-4 text-gray-500 text-sm text-center">No webhooks configured</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {webhooks.map((w) => (
              <div key={w.id} className="px-4 py-3 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${w.enabled ? "bg-green-400" : "bg-gray-500"}`} />
                      <span className="text-sm text-white truncate">{w.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 ml-4">
                      {w.events.map((e) => (
                        <span key={e} className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                    {testResult?.id === w.id && (
                      <div className={`ml-4 mt-1 text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                        {testResult.ok ? "Test successful" : `Test failed: ${testResult.error}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleTest(w.id)}
                      className="p-1 text-gray-400 hover:text-green-400"
                      title="Test"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(w.id, !w.enabled)}
                      className={w.enabled ? "text-green-400" : "text-gray-500"}
                      title={w.enabled ? "Disable" : "Enable"}
                    >
                      {w.enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="p-1 text-gray-400 hover:text-red-400">
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
