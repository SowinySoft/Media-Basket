"use client";

import { ReactNode } from "react";
import { X, Youtube, MessageCircle, Phone } from "lucide-react";

export interface ServicePanelProps {
  serviceId: string;
  connectorType: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const connectorIcons: Record<string, any> = {
  youtube: Youtube,
  reddit: MessageCircle,
  whatsapp: Phone,
};

const connectorColors: Record<string, string> = {
  youtube: "text-red-500",
  reddit: "text-orange-500",
  whatsapp: "text-green-500",
};

export function ServicePanelHeader({ connectorType, title, onClose }: Omit<ServicePanelProps, "serviceId" | "children">) {
  const Icon = connectorIcons[connectorType] || MessageCircle;
  const colorClass = connectorColors[connectorType] || "text-gray-400";

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${colorClass}`} />
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

export function ServicePanelLoading() {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}

export function ServicePanelEmpty({ message = "No data available" }: { message?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-500">
      <div className="text-center">
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

export default function ServicePanel({ serviceId, connectorType, title, onClose, children }: ServicePanelProps) {
  return (
    <div className="h-full flex flex-col bg-gray-900">
      <ServicePanelHeader
        connectorType={connectorType}
        title={title}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
