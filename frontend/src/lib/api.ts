const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Cookie-based auth: browser sends httpOnly cookies automatically.
  // No need to read from localStorage — the server sets access_token cookie on login.
  // For WS or manual token usage, still support localStorage fallback.
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // send cookies cross-origin
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    signup: (email: string, password: string, name: string) =>
      request<{ access_token: string; refresh_token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<any>("/auth/me"),
    logout: () => request<any>("/auth/logout", { method: "POST" }),
    refresh: () =>
      request<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        method: "POST",
      }),
  },
  inbox: {
    list: (orgId: string, params?: { type?: string; unread_only?: boolean; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set("type", params.type);
      if (params?.unread_only) q.set("unread_only", "true");
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return request<{ items: any[]; total: number; unread: number }>(
        `/orgs/${orgId}/notifications${qs ? `?${qs}` : ""}`
      );
    },
    stats: (orgId: string) =>
      request<{ total: number; unread: number; by_type: Record<string, number> }>(
        `/orgs/${orgId}/notifications/stats`
      ),
    markRead: (orgId: string, notificationId: string) =>
      request<any>(`/orgs/${orgId}/notifications/${notificationId}/read`, {
        method: "POST",
      }),
    markAllRead: (orgId: string) =>
      request<any>(`/orgs/${orgId}/notifications/read-all`, {
        method: "POST",
      }),
  },
  retention: {
    cleanup: (orgId: string, params?: { content_days?: number; audit_days?: number; dry_run?: boolean }) => {
      const q = new URLSearchParams();
      if (params?.content_days) q.set("content_days", String(params.content_days));
      if (params?.audit_days) q.set("audit_days", String(params.audit_days));
      if (params?.dry_run) q.set("dry_run", "true");
      const qs = q.toString();
      return request<{ dry_run: boolean; summary: Record<string, number> }>(
        `/orgs/${orgId}/retention/cleanup${qs ? `?${qs}` : ""}`,
        { method: "POST" }
      );
    },
  },
  alerting: {
    listRules: (orgId: string) => request<any[]>(`/orgs/${orgId}/alerting/rules`),
    createRule: (orgId: string, data: any) =>
      request<any>(`/orgs/${orgId}/alerting/rules`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateRule: (orgId: string, ruleId: string, data: any) =>
      request<any>(`/orgs/${orgId}/alerting/rules/${ruleId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteRule: (orgId: string, ruleId: string) =>
      request<void>(`/orgs/${orgId}/alerting/rules/${ruleId}`, {
        method: "DELETE",
      }),
    evaluate: (orgId: string) =>
      request<{ evaluated: number; triggered: number }>(
        `/orgs/${orgId}/alerting/evaluate`,
        { method: "POST" }
      ),
  },
  services: {
    list: (orgId: string) => request<any[]>(`/orgs/${orgId}/services`),
    create: (orgId: string, data: { connector_type: string; display_name: string }) =>
      request<any>(`/orgs/${orgId}/services`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (orgId: string, serviceId: string) =>
      request<void>(`/orgs/${orgId}/services/${serviceId}`, {
        method: "DELETE",
      }),
    sync: (orgId: string, serviceId: string) =>
      request<{ status: string; service_id: string; sync_job_id: string }>(`/orgs/${orgId}/services/${serviceId}/sync`, {
        method: "POST",
      }),
    getSyncJobs: (orgId: string, serviceId: string) =>
      request<any[]>(`/orgs/${orgId}/services/${serviceId}/sync-jobs`),
    getAuthUrl: (connectorType: string, serviceId: string) =>
      request<{ auth_url: string }>(`/services/auth/${connectorType}?service_id=${serviceId}`),
  },
  content: {
    list: (orgId: string, serviceId?: string) => {
      const params = serviceId ? `?service_id=${serviceId}` : "";
      return request<any[]>(`/orgs/${orgId}/content${params}`);
    },
  },
  moderation: {
    create: (orgId: string, data: { content_item_id: string; action: string; details?: any }) =>
      request<any>(`/orgs/${orgId}/moderation`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    list: (orgId: string) => request<any[]>(`/orgs/${orgId}/moderation`),
  },
  youtube: {
    getComments: (orgId: string, serviceId: string, videoId: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/youtube/video/${videoId}`),
    moderateComment: (orgId: string, serviceId: string, commentId: string, action: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/youtube/comment/${commentId}/action?action=${action}`, {
        method: "POST",
      }),
    replyToComment: (orgId: string, serviceId: string, commentId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/youtube/comment/${commentId}/reply?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
    getChannelInfo: (orgId: string, serviceId: string) =>
      request<{ channel: any }>(`/orgs/${orgId}/services/${serviceId}/youtube/channel`),
  },
  reddit: {
    getComments: (orgId: string, serviceId: string, postId: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/reddit/post/${postId}/comments`),
    moderateComment: (orgId: string, serviceId: string, commentId: string, action: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/reddit/comment/${commentId}/action?action=${action}`, {
        method: "POST",
      }),
    replyToComment: (orgId: string, serviceId: string, commentId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/reddit/comment/${commentId}/reply?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
    getSubredditInfo: (orgId: string, serviceId: string) =>
      request<{ subreddit: any }>(`/orgs/${orgId}/services/${serviceId}/reddit/subreddit`),
  },
  whatsapp: {
    getMessages: (orgId: string, serviceId: string, conversationId: string) =>
      request<{ messages: any[] }>(`/orgs/${orgId}/services/${serviceId}/whatsapp/conversation/${conversationId}/messages`),
    moderateMessage: (orgId: string, serviceId: string, messageId: string, action: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/whatsapp/message/${messageId}/action?action=${action}`, {
        method: "POST",
      }),
    replyToConversation: (orgId: string, serviceId: string, conversationId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/whatsapp/conversation/${conversationId}/reply?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
    getContactInfo: (orgId: string, serviceId: string, conversationId: string) =>
      request<{ contact: any }>(`/orgs/${orgId}/services/${serviceId}/whatsapp/contact/${conversationId}`),
  },
  telegram: {
    getChats: (orgId: string, serviceId: string) =>
      request<{ chats: any[] }>(`/orgs/${orgId}/services/${serviceId}/telegram/chats`),
    getMessages: (orgId: string, serviceId: string, chatId: string) =>
      request<{ messages: any[] }>(`/orgs/${orgId}/services/${serviceId}/telegram/chat/${chatId}/messages`),
    sendMessage: (orgId: string, serviceId: string, chatId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/telegram/send?chat_id=${chatId}&message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  instagram: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/instagram/profile`),
    getPosts: (orgId: string, serviceId: string) =>
      request<{ posts: any[] }>(`/orgs/${orgId}/services/${serviceId}/instagram/posts`),
    getComments: (orgId: string, serviceId: string, mediaId: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/instagram/media/${mediaId}/comments`),
    postComment: (orgId: string, serviceId: string, mediaId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/instagram/media/${mediaId}/comment?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  twitter: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/twitter/profile`),
    getTweets: (orgId: string, serviceId: string) =>
      request<{ tweets: any[] }>(`/orgs/${orgId}/services/${serviceId}/twitter/tweets`),
    getMentions: (orgId: string, serviceId: string) =>
      request<{ mentions: any[] }>(`/orgs/${orgId}/services/${serviceId}/twitter/mentions`),
    postTweet: (orgId: string, serviceId: string, message: string, replyTo?: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/twitter/tweet?message=${encodeURIComponent(message)}${replyTo ? `&reply_to=${replyTo}` : ""}`, {
        method: "POST",
      }),
  },
  facebook: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/facebook/profile`),
    getPages: (orgId: string, serviceId: string) =>
      request<{ pages: any[] }>(`/orgs/${orgId}/services/${serviceId}/facebook/pages`),
    getPosts: (orgId: string, serviceId: string, pageId: string) =>
      request<{ posts: any[] }>(`/orgs/${orgId}/services/${serviceId}/facebook/page/${pageId}/posts`),
    getComments: (orgId: string, serviceId: string, postId: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/facebook/post/${postId}/comments`),
    postComment: (orgId: string, serviceId: string, postId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/facebook/post/${postId}/comment?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  linkedin: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/linkedin/profile`),
    getPosts: (orgId: string, serviceId: string) =>
      request<{ posts: any[] }>(`/orgs/${orgId}/services/${serviceId}/linkedin/posts`),
    getComments: (orgId: string, serviceId: string, postUrn: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/linkedin/post/${encodeURIComponent(postUrn)}/comments`),
    postComment: (orgId: string, serviceId: string, postUrn: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/linkedin/post/${encodeURIComponent(postUrn)}/comment?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  tiktok: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/tiktok/profile`),
    getVideos: (orgId: string, serviceId: string) =>
      request<{ videos: any[] }>(`/orgs/${orgId}/services/${serviceId}/tiktok/videos`),
    getComments: (orgId: string, serviceId: string, videoId: string) =>
      request<{ comments: any[] }>(`/orgs/${orgId}/services/${serviceId}/tiktok/video/${videoId}/comments`),
    postComment: (orgId: string, serviceId: string, videoId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/tiktok/video/${videoId}/comment?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  discord: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/discord/profile`),
    getGuilds: (orgId: string, serviceId: string) =>
      request<{ guilds: any[] }>(`/orgs/${orgId}/services/${serviceId}/discord/guilds`),
    getChannels: (orgId: string, serviceId: string, guildId: string) =>
      request<{ channels: any[] }>(`/orgs/${orgId}/services/${serviceId}/discord/guild/${guildId}/channels`),
    getMessages: (orgId: string, serviceId: string, channelId: string) =>
      request<{ messages: any[] }>(`/orgs/${orgId}/services/${serviceId}/discord/channel/${channelId}/messages`),
    sendMessage: (orgId: string, serviceId: string, channelId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/discord/channel/${channelId}/send?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  slack: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/slack/profile`),
    getChannels: (orgId: string, serviceId: string) =>
      request<{ channels: any[] }>(`/orgs/${orgId}/services/${serviceId}/slack/channels`),
    getMessages: (orgId: string, serviceId: string, channelId: string) =>
      request<{ messages: any[] }>(`/orgs/${orgId}/services/${serviceId}/slack/channel/${channelId}/messages`),
    sendMessage: (orgId: string, serviceId: string, channelId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/slack/channel/${channelId}/send?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  mastodon: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/mastodon/profile`),
    getStatuses: (orgId: string, serviceId: string) =>
      request<{ statuses: any[] }>(`/orgs/${orgId}/services/${serviceId}/mastodon/statuses`),
    getNotifications: (orgId: string, serviceId: string) =>
      request<{ notifications: any[] }>(`/orgs/${orgId}/services/${serviceId}/mastodon/notifications`),
    postStatus: (orgId: string, serviceId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/mastodon/status?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
    favourite: (orgId: string, serviceId: string, statusId: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/mastodon/status/${statusId}/favourite`, {
        method: "POST",
      }),
  },
  pinterest: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/pinterest/profile`),
    getBoards: (orgId: string, serviceId: string) =>
      request<{ boards: any[] }>(`/orgs/${orgId}/services/${serviceId}/pinterest/boards`),
    getPins: (orgId: string, serviceId: string, boardId: string) =>
      request<{ pins: any[] }>(`/orgs/${orgId}/services/${serviceId}/pinterest/board/${boardId}/pins`),
  },
  snapchat: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/snapchat/profile`),
    getStories: (orgId: string, serviceId: string) =>
      request<{ stories: any[] }>(`/orgs/${orgId}/services/${serviceId}/snapchat/stories`),
  },
  bluesky: {
    getProfile: (orgId: string, serviceId: string) =>
      request<{ profile: any }>(`/orgs/${orgId}/services/${serviceId}/bluesky/profile`),
    getFeed: (orgId: string, serviceId: string) =>
      request<{ posts: any[] }>(`/orgs/${orgId}/services/${serviceId}/bluesky/feed`),
    getNotifications: (orgId: string, serviceId: string) =>
      request<{ notifications: any[] }>(`/orgs/${orgId}/services/${serviceId}/bluesky/notifications`),
    post: (orgId: string, serviceId: string, message: string) =>
      request<any>(`/orgs/${orgId}/services/${serviceId}/bluesky/post?message=${encodeURIComponent(message)}`, {
        method: "POST",
      }),
  },
  billing: {
    getPlan: () => request<any>("/billing/plan"),
    getUsage: () => request<any>("/billing/usage"),
  },
  org: {
    get: () => request<any>("/orgs/me"),
    update: (data: { name?: string; settings?: any }) =>
      request<any>("/orgs/me", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: () => request<void>("/orgs", { method: "DELETE" }),
  },
  members: {
    list: (orgId: string) => request<any[]>(`/orgs/${orgId}/members`),
    invite: (orgId: string, data: { email: string; role: string }) =>
      request<any>(`/orgs/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateRole: (orgId: string, memberId: string, role: string) =>
      request<any>(`/orgs/${orgId}/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    remove: (orgId: string, memberId: string) =>
      request<void>(`/orgs/${orgId}/members/${memberId}`, {
        method: "DELETE",
      }),
  },
  plugins: {
    list: (orgId: string) => request<any[]>(`/orgs/${orgId}/plugins`),
    install: (orgId: string, data: any) =>
      request<any>(`/orgs/${orgId}/plugins`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (orgId: string, pluginId: string) =>
      request<any>(`/orgs/${orgId}/plugins/${pluginId}`),
    update: (orgId: string, pluginId: string, data: any) =>
      request<any>(`/orgs/${orgId}/plugins/${pluginId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    activate: (orgId: string, pluginId: string) =>
      request<any>(`/orgs/${orgId}/plugins/${pluginId}/activate`, {
        method: "POST",
      }),
    deactivate: (orgId: string, pluginId: string) =>
      request<any>(`/orgs/${orgId}/plugins/${pluginId}/deactivate`, {
        method: "POST",
      }),
    uninstall: (orgId: string, pluginId: string) =>
      request<void>(`/orgs/${orgId}/plugins/${pluginId}`, {
        method: "DELETE",
      }),
  },
  webhooks: {
    list: (orgId: string) => request<any[]>(`/orgs/${orgId}/webhooks`),
    create: (orgId: string, data: any) =>
      request<any>(`/orgs/${orgId}/webhooks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (orgId: string, webhookId: string, data: any) =>
      request<any>(`/orgs/${orgId}/webhooks/${webhookId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (orgId: string, webhookId: string) =>
      request<void>(`/orgs/${orgId}/webhooks/${webhookId}`, {
        method: "DELETE",
      }),
    test: (orgId: string, webhookId: string) =>
      request<any>(`/orgs/${orgId}/webhooks/${webhookId}/test`, {
        method: "POST",
      }),
    events: () => request<string[]>("/webhooks/events"),
  },
  admin: {
    getStats: () => request<any>("/admin/stats"),
    getHealth: () => request<any>("/admin/health"),
    getUsers: () => request<any[]>("/admin/users"),
  },
};
