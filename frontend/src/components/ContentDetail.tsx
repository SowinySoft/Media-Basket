"use client";

import { useStore } from "@/lib/store";
import { X, Trash2, Flag, CheckCircle, MessageSquare, ExternalLink } from "lucide-react";

export default function ContentDetail() {
  const { content, selectedContentId, setSelectedContent, moderateContent } = useStore();

  const selectedItem = content.find((c) => c.id === selectedContentId);

  if (!selectedItem) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select an item to view details</p>
        </div>
      </div>
    );
  }

  const metadata = selectedItem.metadata;
  const payload = selectedItem.payload;

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-800";
      case "negative":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleModerate = async (action: string) => {
    await moderateContent(selectedItem.id, action);
    setSelectedContent(null);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-4 flex items-center justify-between">
        <h3 className="font-semibold">Content Details</h3>
        <button
          onClick={() => setSelectedContent(null)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase">Type</label>
          <p className="font-medium">{selectedItem.content_type}</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase">Content</label>
          <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap">
            {payload?.snippet?.title || payload?.title || payload?.text || "No content"}
          </div>
        </div>

        {payload?.snippet?.description && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Description</label>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {payload.snippet.description}
            </p>
          </div>
        )}

        {metadata && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm border-b pb-2">Analysis</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Sentiment</label>
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
                <label className="text-xs text-gray-500">Spam Score</label>
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (metadata.spam_score || 0) > 0.5 ? "bg-red-500" : "bg-green-500"
                      }`}
                      style={{ width: `${(metadata.spam_score || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {((metadata.spam_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {metadata.auto_tags && metadata.auto_tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-500">Tags</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {metadata.auto_tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {metadata.flagged && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                  <Flag className="w-4 h-4" />
                  <span>Flagged: {metadata.flag_reasons?.join(", ")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-3">Actions</h4>
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

        <div className="border-t pt-4">
          <label className="text-xs text-gray-500">External ID</label>
          <p className="mt-1 text-sm font-mono text-gray-600">{selectedItem.external_id}</p>
        </div>

        <div>
          <label className="text-xs text-gray-500">Ingested At</label>
          <p className="mt-1 text-sm">
            {new Date(selectedItem.ingested_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function FileText(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
