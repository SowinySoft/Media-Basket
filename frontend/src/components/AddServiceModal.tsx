"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import SetupWizard, { WizardStep } from "./SetupWizard";
import {
  ConnectorConfig,
  getConnectorConfig,
  getAllConnectors,
} from "@/lib/connectors";
import { X, ChevronRight, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  onClose: () => void;
  onSelect?: (type: string) => void;
}

export default function AddServiceModal({ onClose, onSelect }: Props) {
  const { fetchServices, org, createService, connectService } = useStore();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [wizardData, setWizardData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "creating" | "connecting" | "error" | "created">("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);

  const connectors = getAllConnectors();
  const config = selectedType ? getConnectorConfig(selectedType) : null;

  const handleSelect = (type: string) => {
    setSelectedType(type);
    setWizardData({});
    setStatus("idle");
    setError(null);
  };

  const handleComplete = async (data: Record<string, string>) => {
    setStatus("creating");
    setError(null);
    setWizardData(data);

    try {
      // Step 1: Create the service
      const displayName = getDisplayName(selectedType!, data);
      await createService(selectedType!, displayName);

      // Step 2: For OAuth connectors, redirect to auth URL
      if (isOAuthConnector(selectedType!)) {
        // Wait for services to be fetched
        await fetchServices();
        const services = useStore.getState().services;
        const service = services.find((s: any) => s.connector_type === selectedType);
        
        if (service) {
          setCreatedServiceId(service.id);
          setStatus("connecting");
          await connectService(service.id, selectedType!);
        }
      } else {
        // For credential-based connectors, we're done
        setStatus("created");
      }
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Setup failed");
    }
  };

  // Check for OAuth callback return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    
    if (connected) {
      setSelectedType(connected);
      setStatus("created");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh services
      fetchServices();
    }
  }, [fetchServices]);

  if (!selectedType) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Add a Service</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {connectors.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.type}
                  onClick={() => handleSelect(c.type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition text-left"
                >
                  <Icon className={`w-6 h-6 ${c.color}`} />
                  <div className="flex-1">
                    <div className="text-white font-medium">{c.name}</div>
                    <div className="text-sm text-gray-400">{c.description}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (status === "created") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Setup Complete!</h2>
            <p className="text-gray-400 mb-6">
              {config?.name || selectedType} has been connected successfully.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Connecting to {config?.name}...</h2>
            <p className="text-gray-400">You'll be redirected back automatically.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Setup Failed</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (config) {
    const wizardSteps: WizardStep[] = config.steps.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      content: (
        <div className="space-y-4">
          {s.instructions && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <ol className="space-y-2">
                {s.instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="font-bold text-blue-400">{i + 1}.</span>
                    {inst}
                  </li>
                ))}
              </ol>
              {config.setupUrl && (
                <a
                  href={config.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  Open {config.name} Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          {s.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-gray-400 mb-1">{field.label}</label>
              <input
                type={field.type || "text"}
                value={wizardData[field.key] || ""}
                onChange={(e) => setWizardData({ ...wizardData, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              {field.help && (
                <p className="mt-1 text-xs text-gray-500">{field.help}</p>
              )}
            </div>
          ))}
        </div>
      ),
    }));

    return (
      <SetupWizard
        title={`Setup ${config.name}`}
        steps={wizardSteps}
        onComplete={handleComplete}
        onClose={onClose}
      />
    );
  }

  return null;
}

function isOAuthConnector(type: string): boolean {
  return ["youtube", "reddit", "instagram", "twitter"].includes(type);
}

function getDisplayName(type: string, data: Record<string, string>): string {
  switch (type) {
    case "youtube":
      return "YouTube Channel";
    case "reddit":
      return "Reddit Account";
    case "whatsapp":
      return `WhatsApp (${data.phone_number || "Connected"})`;
    case "telegram":
      return "Telegram Bot";
    case "instagram":
      return "Instagram Account";
    case "twitter":
      return "Twitter/X Account";
    default:
      return type;
  }
}
