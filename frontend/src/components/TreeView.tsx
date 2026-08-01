"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Tree } from "react-arborist";
import { useStore } from "@/lib/store";
import { FileText, MessageSquare, Video, MessageCircle, ChevronRight, RefreshCw, Send, Image, Twitter, AtSign, Facebook, Briefcase } from "lucide-react";
import TreeContextMenu from "./TreeContextMenu";
import TreeNodeBadge from "./TreeNodeBadge";

interface TreeNode {
  id: string;
  name: string;
  type: "service" | "content";
  connectorType?: string;
  contentType?: string;
  children?: TreeNode[];
  data?: any;
  badge?: number;
  badgeType?: "notification" | "unread" | "flagged";
}

const connectorIcons: Record<string, string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  twitter: "Twitter",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  discord: "Discord",
  slack: "Slack",
  mastodon: "Mastodon",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  bluesky: "Bluesky",
};

const contentIcons: Record<string, any> = {
  video: Video,
  post: FileText,
  comment: MessageSquare,
  message: MessageCircle,
  conversation: MessageCircle,
  tweet: Twitter,
  mention: AtSign,
  chat: Send,
  media: Image,
  page: Facebook,
  profile: AtSign,
};

function NodeRenderer({ node, style, dragHandle }: any) {
  const { connectService } = useStore();
  const [syncing, setSyncing] = useState(false);
  const isService = node.data.type === "service";
  const Icon = isService ? null : contentIcons[node.data.contentType] || FileText;
  const sentiment = node.data.data?.metadata?.sentiment;

  const sentimentColor =
    sentiment === "positive"
      ? "text-green-500"
      : sentiment === "negative"
      ? "text-red-500"
      : "text-gray-500";

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(true);
    const serviceId = node.data.id || node.id;
    const connectorType = node.data.connectorType || node.data.data?.connector_type;
    await connectService(serviceId, connectorType);
    setSyncing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Dispatch custom event for context menu
    const event = new CustomEvent("tree-context-menu", {
      detail: { x: e.clientX, y: e.clientY, node: node.data },
    });
    document.dispatchEvent(event);
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-700 cursor-pointer group"
      onContextMenu={handleContextMenu}
    >
      {isService ? (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      ) : (
        Icon && <Icon className={`w-4 h-4 ${sentimentColor}`} />
      )}
      <span className="flex-1 truncate text-sm">{node.data.name}</span>

      {/* Badge */}
      {node.data.badge > 0 && (
        <TreeNodeBadge count={node.data.badge} type={node.data.badgeType || "notification"} />
      )}

      {isService && (
        <>
          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">
            {connectorIcons[node.data.connectorType] || node.data.connectorType}
          </span>
          <button
            onClick={handleConnect}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Connect to OAuth"
            disabled={syncing}
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          </button>
        </>
      )}
      {!isService && node.data.data?.metadata?.flagged && (
        <span className="w-2 h-2 rounded-full bg-red-500" />
      )}
    </div>
  );
}

export default function TreeView() {
  const {
    services,
    content,
    selectedServiceId,
    searchQuery,
    setSelectedService,
    setSelectedContent,
    fetchServices,
    fetchContent,
    syncService,
  } = useStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: any } | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedServiceId) {
      fetchContent(selectedServiceId);
    }
  }, [selectedServiceId]);

  // Context menu listener
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setContextMenu({ x: ce.detail.x, y: ce.detail.y, node: ce.detail.node });
    };
    document.addEventListener("tree-context-menu", handler);
    return () => document.removeEventListener("tree-context-menu", handler);
  }, []);

  const handleContextAction = useCallback((action: string, node: any) => {
    switch (action) {
      case "sync":
        syncService(node.id);
        break;
      case "view_content":
        setSelectedService(node.id);
        break;
      case "open_settings":
        window.location.href = "/settings/services";
        break;
      case "view":
        setSelectedContent(node.id);
        break;
      case "copy_id":
        navigator.clipboard.writeText(node.id);
        break;
      case "disconnect":
        if (confirm(`Disconnect ${node.name}?`)) {
          // TODO: call api.services.delete
        }
        break;
      case "approve":
      case "flag":
      case "delete":
        // TODO: call moderation API
        break;
    }
  }, [syncService, setSelectedService, setSelectedContent]);

  const treeData = useMemo(() => {
    const serviceNodes: TreeNode[] = services.map((service) => {
      const serviceContent = content.filter(
        (c) => c.service_instance_id === service.id
      );

      const flaggedCount = serviceContent.filter((c) => c.metadata?.flagged).length;
      const contentByType: Record<string, TreeNode[]> = {};
      serviceContent.forEach((item) => {
        const type = item.content_type;
        if (!contentByType[type]) {
          contentByType[type] = [];
        }
        contentByType[type].push({
          id: item.id,
          name: item.payload?.snippet?.title || item.payload?.title || item.payload?.text || item.external_id,
          type: "content",
          contentType: item.content_type,
          data: item,
          badge: item.metadata?.flagged ? 1 : 0,
          badgeType: item.metadata?.flagged ? "flagged" : undefined,
        });
      });

      const children: TreeNode[] = [];
      Object.entries(contentByType).forEach(([type, items]) => {
        if (items.length > 0) {
          children.push({
            id: `${service.id}-${type}`,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})`,
            type: "service",
            children: items,
          });
        }
      });

      return {
        id: service.id,
        name: service.display_name,
        type: "service" as const,
        connectorType: service.connector_type,
        children: children.length > 0 ? children : undefined,
        data: service,
        badge: flaggedCount,
        badgeType: flaggedCount > 0 ? "flagged" as const : undefined,
      };
    });

    return serviceNodes;
  }, [services, content]);

  const filteredTreeData = useMemo(() => {
    if (!searchQuery) return treeData;

    const query = searchQuery.toLowerCase();
    return treeData
      .map((service) => {
        const matchesService = service.name.toLowerCase().includes(query);
        const filteredChildren = service.children
          ?.map((category) => {
            const filteredItems = category.children?.filter(
              (item) =>
                item.name.toLowerCase().includes(query) ||
                item.data?.payload?.snippet?.description?.toLowerCase().includes(query)
            );
            if (filteredItems && filteredItems.length > 0) {
              return { ...category, children: filteredItems };
            }
            return null;
          })
          .filter(Boolean);

        if (matchesService || (filteredChildren && filteredChildren.length > 0)) {
          return {
            ...service,
            children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : service.children,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [treeData, searchQuery]);

  const handleSelect = (selected: any[]) => {
    if (selected.length > 0) {
      const node = selected[0];
      if (node.type === "service") {
        setSelectedService(node.id);
      } else {
        setSelectedContent(node.id);
      }
    }
  };

  return (
    <div className="h-full">
      <Tree
        data={filteredTreeData as any}
        onSelect={handleSelect}
        openByDefault={true}
        width="100%"
        height={800}
        indent={24}
        rowHeight={32}
      >
        {NodeRenderer}
      </Tree>

      {contextMenu && (
        <TreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
