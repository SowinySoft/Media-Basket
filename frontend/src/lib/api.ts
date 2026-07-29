const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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
      request<{ status: string; service_id: string }>(`/orgs/${orgId}/services/${serviceId}/sync`, {
        method: "POST",
      }),
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
  billing: {
    getPlan: () => request<any>("/billing/plan"),
    getUsage: () => request<any>("/billing/usage"),
  },
};
