"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Grid, RefreshCw } from "lucide-react";
import ServicePanel from "./ServicePanel";

interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  link?: string;
  image?: { large?: { url: string }; small?: { url: string } };
  created_at: string;
}

interface Props {
  serviceId: string;
  onClose: () => void;
}

export default function PinterestPanel({ serviceId, onClose }: Props) {
  const [pins, setPins] = useState<PinterestPin[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const token = localStorage.getItem("access_token");

  const fetchPins = async () => {
    try {
      const boardsRes = await fetch(
        `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/pinterest/boards`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (boardsRes.ok) {
        const boardsData = await boardsRes.json();
        if (boardsData.boards?.length > 0) {
          const pinsRes = await fetch(
            `${API_BASE}/orgs/${useStore.getState().org?.id}/services/${serviceId}/pinterest/board/${boardsData.boards[0].id}/pins`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (pinsRes.ok) {
            const pinsData = await pinsRes.json();
            setPins(pinsData.pins || []);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch pins:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchPins();
      setLoading(false);
    };
    load();
  }, [serviceId]);

  return (
    <ServicePanel serviceId={serviceId} connectorType="pinterest" title="Pinterest Manager" onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">Pins</h4>
          <button onClick={fetchPins} className="p-2 hover:bg-gray-700 rounded">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : pins.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">No pins found</div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {pins.map((pin) => (
              <div key={pin.id} className="break-inside-avoid">
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {pin.image?.large?.url || pin.image?.small?.url ? (
                    <img
                      src={pin.image?.large?.url || pin.image?.small?.url}
                      alt={pin.title || ""}
                      className="w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-square bg-gray-700 flex items-center justify-center">
                      <Grid className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs text-white truncate">{pin.title || "Untitled"}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(pin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ServicePanel>
  );
}
