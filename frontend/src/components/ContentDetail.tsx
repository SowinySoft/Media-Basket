"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { X, Trash2, Flag, CheckCircle, Settings } from "lucide-react";
import YouTubePanel from "./YouTubePanel";
import RedditPanel from "./RedditPanel";
import WhatsAppPanel from "./WhatsAppPanel";
import TelegramPanel from "./TelegramPanel";
import InstagramPanel from "./InstagramPanel";
import TwitterPanel from "./TwitterPanel";

export default function ContentDetail() {
  const { content, selectedContentId, setSelectedContent, moderateContent, services } = useStore();
  const [showServicePanel, setShowServicePanel] = useState(false);

  const selectedItem = content.find((c) => c.id === selectedContentId);

  if (!selectedItem) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p>Select an item to view details</p>
        </div>
      </div>
    );
  }

  const metadata = selectedItem.metadata;
  const payload = selectedItem.payload;
  const service = services.find((s) => s.id === selectedItem.service_instance_id);
  const connectorType = service?.connector_type || "";

  // Determine which panel to show
  const isYouTube = connectorType === "youtube" && selectedItem.content_type === "video";
  const isReddit = connectorType === "reddit" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isWhatsApp = connectorType === "whatsapp" && (selectedItem.content_type === "message" || selectedItem.content_type === "conversation");
  const isTelegram = connectorType === "telegram" && (selectedItem.content_type === "message" || selectedItem.content_type === "chat");
  const isInstagram = connectorType === "instagram" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isTwitter = connectorType === "twitter" && (selectedItem.content_type === "tweet" || selectedItem.content_type === "mention");

  if (showServicePanel) {
    if (isYouTube) {
      const stats = {
        views: payload?.statistics?.viewCount || "0",
        likes: payload?.statistics?.likeCount || "0",
        comments: payload?.statistics?.commentCount || "0",
      };
      return (
        <YouTubePanel
          serviceId={selectedItem.service_instance_id}
          videoId={selectedItem.external_id}
          title={payload?.snippet?.title || ""}
          description={payload?.snippet?.description || ""}
          stats={stats}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }

    if (isReddit) {
      const stats = {
        score: payload?.score || "0",
        comments: payload?.num_comments || "0",
      };
      return (
        <RedditPanel
          serviceId={selectedItem.service_instance_id}
          postId={selectedItem.external_id}
          postTitle={payload?.title || ""}
          postBody={payload?.selftext || payload?.body || ""}
          stats={stats}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }

    if (isWhatsApp) {
      return (
        <WhatsAppPanel
          serviceId={selectedItem.service_instance_id}
          conversationId={selectedItem.external_id}
          contactName={payload?.from || payload?.contact_name || "Unknown"}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }

    if (isTelegram) {
      return (
        <TelegramPanel
          serviceId={selectedItem.service_instance_id}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }

    if (isInstagram) {
      return (
        <InstagramPanel
          serviceId={selectedItem.service_instance_id}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }

    if (isTwitter) {
      return (
        <TwitterPanel
          serviceId={selectedItem.service_instance_id}
          onClose={() => setShowServicePanel(false)}
        />
      );
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-900/50 text-green-300";
      case "negative":
        return "bg-red-900/50 text-red-300";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  const handleModerate = async (action: string) => {
    await moderateContent(selectedItem.id, action);
    setSelectedContent(null);
  };

  const canOpenManager = isYouTube || isReddit || isWhatsApp || isTelegram || isInstagram || isTwitter;

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Content Details</h3>
        <button
          onClick={() => setSelectedContent(null)}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-400 uppercase">Type</label>
          <p className="font-medium text-white">{selectedItem.content_type}</p>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase">Content</label>
          <div className="mt-1 p-3 bg-gray-800 border border-gray-700 rounded text-sm whitespace-pre-wrap text-white">
            {payload?.snippet?.title || payload?.title || payload?.text || payload?.body || "No content"}
          </div>
        </div>

        {selectedItem.content_type === "video" && selectedItem.external_id && (
          <div>
            <label className="text-xs text-gray-400 uppercase">Preview</label>
            <div className="mt-1 aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${selectedItem.external_id}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => setShowServicePanel(true)}
              className="mt-2 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Open YouTube Manager
            </button>
          </div>
        )}

        {isReddit && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Reddit Manager
          </button>
        )}

        {isWhatsApp && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open WhatsApp Manager
          </button>
        )}

        {isTelegram && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Telegram Manager
          </button>
        )}

        {isInstagram && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Instagram Manager
          </button>
        )}

        {isTwitter && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Twitter Manager
          </button>
        )}

        {payload?.snippet?.description && (
          <div>
            <label className="text-xs text-gray-400 uppercase">Description</label>
            <p className="mt-1 text-sm text-gray-300">
              {payload.snippet.description}
            </p>
          </div>
        )}

        {metadata && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm border-b border-gray-700 pb-2 text-white">Analysis</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Sentiment</label>
                <div className={`mt-1 px-2 py-1 rounded text-xs inline-block ${getSentimentColor(metadata.sentiment)}`}>
                  {metadata.sentiment || "N/A"}
                  {metadata.sentiment_score != null && (
                    <span className="ml-1 opacity-75">
                      ({metadata.sentiment_score.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Spam Score</label>
                <div className="mt-1">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (metadata.spam_score || 0) > 0.5 ? "bg-red-500" : "bg-green-500"
                      }`}
                      style={{ width: `${(metadata.spam_score || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {((metadata.spam_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {metadata.auto_tags && metadata.auto_tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-400">Tags</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {metadata.auto_tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {metadata.flagged && (
              <div className="p-2 bg-red-900/20 rounded border border-red-800">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <Flag className="w-4 h-4" />
                  <span>Flagged: {metadata.flag_reasons?.join(", ")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-gray-700 pt-4">
          <h4 className="font-medium text-sm mb-3 text-white">Actions</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleModerate("approve")}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => handleModerate("flag")}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
            >
              <Flag className="w-4 h-4" />
              Flag
            </button>
            <button
              onClick={() => handleModerate("delete")}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <label className="text-xs text-gray-400">External ID</label>
          <p className="mt-1 text-sm font-mono text-gray-400">{selectedItem.external_id}</p>
        </div>

        <div>
          <label className="text-xs text-gray-400">Ingested At</label>
          <p className="mt-1 text-sm text-gray-300">
            {new Date(selectedItem.ingested_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
