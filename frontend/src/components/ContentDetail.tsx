"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  X,
  Trash2,
  Flag,
  CheckCircle,
  Settings,
  Play,
  MessageSquare,
  Send,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Globe,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import YouTubePanel from "./YouTubePanel";
import RedditPanel from "./RedditPanel";
import WhatsAppPanel from "./WhatsAppPanel";
import TelegramPanel from "./TelegramPanel";
import InstagramPanel from "./InstagramPanel";
import TwitterPanel from "./TwitterPanel";
import FacebookPanel from "./FacebookPanel";
import LinkedInPanel from "./LinkedInPanel";
import TikTokPanel from "./TikTokPanel";
import DiscordPanel from "./DiscordPanel";
import SlackPanel from "./SlackPanel";
import MastodonPanel from "./MastodonPanel";
import PinterestPanel from "./PinterestPanel";
import SnapchatPanel from "./SnapchatPanel";
import BlueskyPanel from "./BlueskyPanel";

interface Comment {
  id: string;
  author_name?: string;
  author_avatar?: string;
  text?: string;
  body?: string;
  content?: string;
  sentiment?: string;
  sentiment_score?: number;
  created_at?: string;
  timestamp?: string;
  likes?: number;
  replies?: Comment[];
}

export default function ContentDetail() {
  const { content, selectedContentId, setSelectedContent, moderateContent, services, org } = useStore();
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [moderationLoading, setModerationLoading] = useState<string | null>(null);

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

  const isYouTube = connectorType === "youtube" && selectedItem.content_type === "video";
  const isReddit = connectorType === "reddit" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isWhatsApp = connectorType === "whatsapp" && (selectedItem.content_type === "message" || selectedItem.content_type === "conversation");
  const isTelegram = connectorType === "telegram" && (selectedItem.content_type === "message" || selectedItem.content_type === "chat");
  const isInstagram = connectorType === "instagram" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isTwitter = connectorType === "twitter" && (selectedItem.content_type === "tweet" || selectedItem.content_type === "mention");
  const isFacebook = connectorType === "facebook" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isLinkedIn = connectorType === "linkedin" && (selectedItem.content_type === "post" || selectedItem.content_type === "comment");
  const isTikTok = connectorType === "tiktok" && (selectedItem.content_type === "video" || selectedItem.content_type === "comment");
  const isDiscord = connectorType === "discord" && (selectedItem.content_type === "message" || selectedItem.content_type === "channel");
  const isSlack = connectorType === "slack" && (selectedItem.content_type === "message" || selectedItem.content_type === "channel");
  const isMastodon = connectorType === "mastodon" && (selectedItem.content_type === "status" || selectedItem.content_type === "notification");
  const isPinterest = connectorType === "pinterest" && (selectedItem.content_type === "pin" || selectedItem.content_type === "board");
  const isSnapchat = connectorType === "snapchat" && (selectedItem.content_type === "story" || selectedItem.content_type === "snap");
  const isBluesky = connectorType === "bluesky" && (selectedItem.content_type === "post" || selectedItem.content_type === "notification");

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
      return <WhatsAppPanel serviceId={selectedItem.service_instance_id} conversationId={selectedItem.external_id} contactName={payload?.from || payload?.contact_name || "Unknown"} onClose={() => setShowServicePanel(false)} />;
    }
    if (isTelegram) {
      return <TelegramPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isInstagram) {
      return <InstagramPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isTwitter) {
      return <TwitterPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isFacebook) {
      return <FacebookPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isLinkedIn) {
      return <LinkedInPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isTikTok) {
      return <TikTokPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isDiscord) {
      return <DiscordPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isSlack) {
      return <SlackPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isMastodon) {
      return <MastodonPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isPinterest) {
      return <PinterestPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isSnapchat) {
      return <SnapchatPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
    if (isBluesky) {
      return <BlueskyPanel serviceId={selectedItem.service_instance_id} onClose={() => setShowServicePanel(false)} />;
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-900/50 text-green-300 border border-green-700/50";
      case "negative":
        return "bg-red-900/50 text-red-300 border border-red-700/50";
      default:
        return "bg-gray-700 text-gray-300 border border-gray-600";
    }
  };

  const getSentimentBg = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "text-green-400";
      case "negative":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const handleModerate = async (action: string) => {
    if (!org) return;
    setModerationLoading(action);
    try {
      await api.moderation.create(org.id, {
        content_item_id: selectedItem.id,
        action,
      });
      await moderateContent(selectedItem.id, action);
      setSelectedContent(null);
    } catch (err) {
      console.error("Moderation failed:", err);
    } finally {
      setModerationLoading(null);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await moderateContent(selectedItem.id, "reply", { message: replyText });
      setReplyText("");
      setShowReplyInput(false);
    } catch (err) {
      console.error("Reply failed:", err);
    }
  };

  const handleCommentReply = async (commentId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await moderateContent(selectedItem.id, "reply", { comment_id: commentId, message: text });
    } catch (err) {
      console.error("Comment reply failed:", err);
    }
  };

  const getVideoId = () => {
    if (isYouTube) return selectedItem.external_id;
    if (isTikTok) {
      const url = payload?.url || payload?.web_video_url || "";
      const match = url.match(/video\/(\d+)/);
      return match?.[1] || null;
    }
    return null;
  };

  const getThumbnailUrl = () => {
    if (isYouTube) {
      return `https://img.youtube.com/vi/${selectedItem.external_id}/hqdefault.jpg`;
    }
    if (isTikTok) {
      return payload?.cover_image_url || payload?.thumbnail_url || null;
    }
    if (isInstagram) {
      return payload?.media_url || payload?.thumbnail_url || payload?.image_url || null;
    }
    if (isPinterest) {
      return payload?.image?.original?.url || payload?.images?.orig?.url || payload?.thumbnail_url || null;
    }
    return null;
  };

  const getImageUrl = () => {
    if (isInstagram) {
      return payload?.media_url || payload?.image_url || payload?.images?.[0]?.url || null;
    }
    if (isPinterest) {
      return payload?.image?.original?.url || payload?.images?.orig?.url || payload?.thumbnail_url || null;
    }
    return null;
  };

  const getMessageContent = () => {
    if (isWhatsApp) {
      return payload?.body || payload?.text || payload?.message || "";
    }
    if (isTelegram) {
      return payload?.text || payload?.message || payload?.body || "";
    }
    if (isDiscord) {
      return payload?.content || payload?.text || payload?.message || "";
    }
    if (isSlack) {
      return payload?.text || payload?.message || payload?.content || "";
    }
    return payload?.text || payload?.body || payload?.content || "";
  };

  const getAuthorInfo = () => {
    const authorName =
      payload?.author?.name ||
      payload?.author?.username ||
      payload?.author_name ||
      payload?.from ||
      payload?.sender ||
      payload?.user?.name ||
      payload?.user?.username ||
      payload?.author_name ||
      null;
    const authorAvatar =
      payload?.author?.avatar ||
      payload?.author_avatar ||
      payload?.from_avatar ||
      payload?.sender_avatar ||
      payload?.user?.avatar ||
      null;
    return { name: authorName, avatar: authorAvatar };
  };

  const getEngagement = () => {
    return {
      likes: payload?.like_count ?? payload?.likes ?? payload?.favorite_count ?? payload?.heart_count ?? payload?.upvote_count ?? null,
      comments: payload?.comment_count ?? payload?.comments ?? payload?.num_comments ?? null,
      shares: payload?.share_count ?? payload?.shares ?? payload?.retweet_count ?? null,
      views: payload?.view_count ?? payload?.views ?? payload?.statistics?.viewCount ?? null,
    };
  };

  const getComments = (): Comment[] => {
    return payload?.comments || payload?.replies || payload?.thread?.replies || [];
  };

  const getFullText = () => {
    return (
      payload?.text ||
      payload?.full_text ||
      payload?.body ||
      payload?.content ||
      payload?.selftext ||
      payload?.message ||
      payload?.snippet?.title ||
      payload?.title ||
      ""
    );
  };

  const isVideoContent = isYouTube || isTikTok;
  const isImageContent = isInstagram || isPinterest;
  const isTextContent = isTwitter || isReddit || isMastodon || isBluesky;
  const isMessageContent = isWhatsApp || isTelegram || isDiscord || isSlack;

  const comments = getComments();
  const authorInfo = getAuthorInfo();
  const engagement = getEngagement();
  const thumbnailUrl = getThumbnailUrl();
  const imageUrl = getImageUrl();
  const videoId = getVideoId();
  const messageContent = getMessageContent();
  const fullText = getFullText();

  const formatEngagement = (value: number | string | null) => {
    if (value === null || value === undefined) return null;
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (isNaN(num)) return null;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const platformCreatedAt = payload?.created_at || payload?.publish_time || payload?.published_at || payload?.timestamp || selectedItem.ingested_at;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 uppercase font-medium">
            {connectorType}
          </span>
          <h3 className="font-semibold text-white truncate max-w-[200px]">
            {payload?.snippet?.title || payload?.title || messageContent.slice(0, 50) || selectedItem.content_type}
          </h3>
        </div>
        <button
          onClick={() => setSelectedContent(null)}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Moderation Toolbar */}
      <div className="sticky top-[57px] bg-gray-800/95 backdrop-blur border-b border-gray-700 px-4 py-2 flex items-center gap-2 z-10">
        <button
          onClick={() => handleModerate("approve")}
          disabled={moderationLoading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={() => handleModerate("flag")}
          disabled={moderationLoading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
        >
          <Flag className="w-4 h-4" />
          Flag
        </button>
        <button
          onClick={() => handleModerate("delete")}
          disabled={moderationLoading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        <div className="w-px h-6 bg-gray-600 mx-1" />
        <button
          onClick={() => setShowReplyInput(!showReplyInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Reply
        </button>
      </div>

      {/* Reply Input */}
      {showReplyInput && (
        <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
              placeholder="Type a reply..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Author Info */}
        {authorInfo.name && (
          <div className="flex items-center gap-3">
            {authorInfo.avatar ? (
              <img src={authorInfo.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-white">{authorInfo.name}</p>
              {payload?.author?.username && (
                <p className="text-xs text-gray-400">@{payload.author.username}</p>
              )}
            </div>
          </div>
        )}

        {/* Rich Content View */}
        {isVideoContent && (
          <div>
            {videoId && connectorType === "youtube" ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
                <img
                  src={thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
              </div>
            ) : thumbnailUrl ? (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <img src={thumbnailUrl} alt="" className="w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
              </div>
            ) : null}
            {fullText && (
              <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded text-sm whitespace-pre-wrap text-gray-200">
                {fullText}
              </div>
            )}
          </div>
        )}

        {isImageContent && imageUrl && (
          <div>
            <img
              src={imageUrl}
              alt=""
              className="w-full rounded-lg object-cover max-h-96"
            />
            {fullText && (
              <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded text-sm whitespace-pre-wrap text-gray-200">
                {fullText}
              </div>
            )}
          </div>
        )}

        {isTextContent && (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
              {fullText || "No text content"}
            </p>
          </div>
        )}

        {isMessageContent && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-1">
                {authorInfo.avatar ? (
                  <img src={authorInfo.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="max-w-[85%]">
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-blue-600 text-white text-sm">
                  {messageContent || "Empty message"}
                </div>
                {platformCreatedAt && (
                  <p className="text-[10px] text-gray-500 mt-0.5 ml-1">
                    {formatDate(platformCreatedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fallback for non-classified content */}
        {!isVideoContent && !isImageContent && !isTextContent && !isMessageContent && (
          <div>
            <label className="text-xs text-gray-400 uppercase">Content</label>
            <div className="mt-1 p-3 bg-gray-800 border border-gray-700 rounded text-sm whitespace-pre-wrap text-white">
              {fullText || "No content"}
            </div>
          </div>
        )}

        {/* Engagement Stats */}
        {(engagement.likes !== null || engagement.comments !== null || engagement.shares !== null || engagement.views !== null) && (
          <div className="flex items-center gap-4 text-gray-400">
            {engagement.likes !== null && (
              <div className="flex items-center gap-1 text-sm">
                <Heart className="w-4 h-4 text-red-400" />
                <span>{formatEngagement(engagement.likes)}</span>
              </div>
            )}
            {engagement.comments !== null && (
              <div className="flex items-center gap-1 text-sm">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                <span>{formatEngagement(engagement.comments)}</span>
              </div>
            )}
            {engagement.shares !== null && (
              <div className="flex items-center gap-1 text-sm">
                <Share2 className="w-4 h-4 text-green-400" />
                <span>{formatEngagement(engagement.shares)}</span>
              </div>
            )}
            {engagement.views !== null && (
              <div className="flex items-center gap-1 text-sm">
                <Eye className="w-4 h-4 text-purple-400" />
                <span>{formatEngagement(engagement.views)}</span>
              </div>
            )}
          </div>
        )}

        {/* Manager Buttons */}
        {isYouTube && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open YouTube Manager
          </button>
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
        {isFacebook && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Facebook Manager
          </button>
        )}
        {isLinkedIn && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open LinkedIn Manager
          </button>
        )}
        {isTikTok && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open TikTok Manager
          </button>
        )}
        {isDiscord && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Discord Manager
          </button>
        )}
        {isSlack && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Slack Manager
          </button>
        )}
        {isMastodon && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Mastodon Manager
          </button>
        )}
        {isPinterest && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Pinterest Manager
          </button>
        )}
        {isSnapchat && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Snapchat Manager
          </button>
        )}
        {isBluesky && (
          <button
            onClick={() => setShowServicePanel(true)}
            className="w-full py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Open Bluesky Manager
          </button>
        )}

        {/* Metadata Section */}
        {metadata && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm border-b border-gray-700 pb-2 text-white">Metadata</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Sentiment</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${getSentimentColor(metadata.sentiment)}`}>
                    {metadata.sentiment || "N/A"}
                  </span>
                  {metadata.sentiment_score != null && (
                    <span className={`ml-2 text-xs ${getSentimentBg(metadata.sentiment)}`}>
                      {(metadata.sentiment_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Spam Score</label>
                <div className="mt-1">
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        (metadata.spam_score || 0) > 0.7
                          ? "bg-red-500"
                          : (metadata.spam_score || 0) > 0.4
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min((metadata.spam_score || 0) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5 block">
                    {((metadata.spam_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {metadata.language && (
              <div>
                <label className="text-xs text-gray-400">Language</label>
                <div className="mt-1">
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 inline-block">
                    <Globe className="w-3 h-3" />
                    {metadata.language}
                  </span>
                </div>
              </div>
            )}

            {metadata.auto_tags && metadata.auto_tags.length > 0 && (
              <div>
                <label className="text-xs text-gray-400">Tags</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {metadata.auto_tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full text-xs border border-blue-800/50"
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
                  <span>Flagged: {metadata.flag_reasons?.join(", ") || "No reason provided"}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thread / Comments View */}
        {comments.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2 w-full text-left group"
            >
              <h4 className="font-medium text-sm text-white">Comments ({comments.length})</h4>
              {showComments ? (
                <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
              )}
            </button>

            {showComments && (
              <div className="space-y-3 mt-2">
                {comments.map((comment) => (
                  <CommentBubble
                    key={comment.id}
                    comment={comment}
                    onReply={handleCommentReply}
                    getSentimentColor={getSentimentColor}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description fallback */}
        {!fullText && payload?.snippet?.description && (
          <div>
            <label className="text-xs text-gray-400 uppercase">Description</label>
            <p className="mt-1 text-sm text-gray-300">{payload.snippet.description}</p>
          </div>
        )}

        {/* External ID & Ingested At */}
        <div className="border-t border-gray-700 pt-4 space-y-2">
          <div>
            <label className="text-xs text-gray-400">External ID</label>
            <p className="mt-1 text-sm font-mono text-gray-400 break-all">{selectedItem.external_id}</p>
          </div>

          <div>
            <label className="text-xs text-gray-400">Ingested At</label>
            <p className="mt-1 text-sm text-gray-300">
              {new Date(selectedItem.ingested_at).toLocaleString()}
            </p>
          </div>

          {platformCreatedAt && platformCreatedAt !== selectedItem.ingested_at && (
            <div>
              <label className="text-xs text-gray-400">Created At (Platform)</label>
              <p className="mt-1 text-sm text-gray-300">{formatDate(platformCreatedAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentBubble({
  comment,
  onReply,
  getSentimentColor,
}: {
  comment: Comment;
  onReply: (id: string, text: string) => void;
  getSentimentColor: (s?: string) => string;
}) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const commentText = comment.text || comment.body || comment.content || "";
  const commentAuthor = comment.author_name || "Unknown";
  const commentTime = comment.created_at || comment.timestamp;

  return (
    <div className="pl-3 border-l-2 border-gray-700">
      <div className="flex items-start gap-2">
        {comment.author_avatar ? (
          <img src={comment.author_avatar} alt="" className="w-6 h-6 rounded-full object-cover mt-0.5" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center mt-0.5">
            <User className="w-3 h-3 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{commentAuthor}</span>
            {comment.sentiment && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getSentimentColor(comment.sentiment)}`}>
                {comment.sentiment}
              </span>
            )}
            {commentTime && (
              <span className="text-[10px] text-gray-500">
                {new Date(commentTime).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap">{commentText}</p>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              Reply
            </button>
          </div>
          {showReply && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && replyText.trim()) {
                    onReply(comment.id, replyText);
                    setReplyText("");
                    setShowReply(false);
                  }
                }}
                placeholder="Reply..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => {
                  if (replyText.trim()) {
                    onReply(comment.id, replyText);
                    setReplyText("");
                    setShowReply(false);
                  }
                }}
                disabled={!replyText.trim()}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          )}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {comment.replies.map((reply) => (
                <CommentBubble
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  getSentimentColor={getSentimentColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
