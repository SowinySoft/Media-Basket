"use client";

import { useEffect, useRef, useMemo } from "react";
import { Tree } from "react-arborist";
import { useStore } from "@/lib/store";
import { FileText, MessageSquare, Video, MessageCircle, ChevronRight, ExternalLink } from "lucide-react";

interface TreeNode {
  id: string;
  name: string;
  type: "service" | "content";
  connectorType?: string;
  contentType?: string;
  children?: TreeNode[];
  data?: any;
}

const connectorIcons: Record<string, string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
};

const contentIcons: Record<string, any> = {
  video: Video,
  post: FileText,
  comment: MessageSquare,
  message: MessageCircle,
  conversation: MessageCircle,
};

function NodeRenderer({ node, style, dragHandle }: any) {
  const isService = node.data.type === "service";
  const Icon = isService ? null : contentIcons[node.data.contentType] || FileText;
  const sentiment = node.data.data?.metadata?.sentiment;

  const sentimentColor =
    sentiment === "positive"
      ? "text-green-500"
      : sentiment === "negative"
      ? "text-red-500"
      : "text-gray-500";

  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
    >
      {isService ? (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      ) : (
        Icon && <Icon className={`w-4 h-4 ${sentimentColor}`} />
      )}
      <span className="flex-1 truncate text-sm">{node.data.name}</span>
      {isService && (
        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">
          {connectorIcons[node.data.connectorType] || node.data.connectorType}
        </span>
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
  } = useStore();

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedServiceId) {
      fetchContent(selectedServiceId);
    }
  }, [selectedServiceId]);

  const treeData = useMemo(() => {
    const serviceNodes: TreeNode[] = services.map((service) => {
      const serviceContent = content.filter(
        (c) => c.service_instance_id === service.id
      );

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
        data={filteredTreeData}
        nodeRenderer={NodeRenderer}
        onSelect={handleSelect}
        openByDefault={true}
        width="100%"
        height={800}
        indent={24}
        rowHeight={32}
      >
        {NodeRenderer}
      </Tree>
    </div>
  );
}
