import { create } from "zustand";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface Service {
  id: string;
  org_id: string;
  connector_type: string;
  display_name: string;
  status: string;
  last_synced_at?: string;
  created_at: string;
}

interface ContentItem {
  id: string;
  service_instance_id: string;
  external_id: string;
  content_type: string;
  category: string;
  payload: any;
  ingested_at: string;
  metadata?: {
    sentiment?: string;
    sentiment_score?: number;
    spam_score?: number;
    language?: string;
    auto_tags?: string[];
    flagged?: boolean;
    flag_reasons?: string[];
  };
}

interface TreeState {
  user: User | null;
  org: Org | null;
  services: Service[];
  content: ContentItem[];
  selectedServiceId: string | null;
  selectedContentId: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  ws: WebSocket | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchContent: (serviceId?: string) => Promise<void>;
  createService: (connectorType: string, displayName: string) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  moderateContent: (contentId: string, action: string, details?: any) => Promise<void>;
  setSelectedService: (serviceId: string | null) => void;
  setSelectedContent: (contentId: string | null) => void;
  setSearchQuery: (query: string) => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const useStore = create<TreeState>((set, get) => ({
  user: null,
  org: null,
  services: [],
  content: [],
  selectedServiceId: null,
  selectedContentId: null,
  searchQuery: "",
  isLoading: false,
  error: null,
  ws: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Login failed");
      }
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      await get().fetchUser();
      await get().fetchServices();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Signup failed");
      }
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      await get().fetchUser();
      await get().fetchServices();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    get().disconnectWebSocket();
    set({ user: null, org: null, services: [], content: [], selectedServiceId: null, selectedContentId: null });
  },

  fetchUser: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      const user = await res.json();
      set({ user });
    } catch (err) {
      console.error("Failed to fetch user:", err);
    }
  },

  fetchServices: async () => {
    const token = localStorage.getItem("access_token");
    const user = get().user;
    if (!token || !user) return;

    set({ isLoading: true });
    try {
      const orgId = get().org?.id;
      if (!orgId) {
        await get().fetchUser();
        return;
      }
      const res = await fetch(`${API_BASE}/orgs/${orgId}/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch services");
      const services = await res.json();
      set({ services });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchContent: async (serviceId?: string) => {
    const token = localStorage.getItem("access_token");
    const orgId = get().org?.id;
    if (!token || !orgId) return;

    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (serviceId) params.append("service_id", serviceId);
      const res = await fetch(`${API_BASE}/orgs/${orgId}/content?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch content");
      const content = await res.json();
      set({ content });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createService: async (connectorType, displayName) => {
    const token = localStorage.getItem("access_token");
    const orgId = get().org?.id;
    if (!token || !orgId) return;

    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connector_type: connectorType, display_name: displayName }),
      });
      if (!res.ok) throw new Error("Failed to create service");
      await get().fetchServices();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteService: async (serviceId) => {
    const token = localStorage.getItem("access_token");
    const orgId = get().org?.id;
    if (!token || !orgId) return;

    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/services/${serviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete service");
      set({ selectedServiceId: null });
      await get().fetchServices();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  moderateContent: async (contentId, action, details) => {
    const token = localStorage.getItem("access_token");
    const orgId = get().org?.id;
    if (!token || !orgId) return;

    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/moderation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content_item_id: contentId, action, details }),
      });
      if (!res.ok) throw new Error("Failed to moderate content");
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setSelectedService: (serviceId) => set({ selectedServiceId: serviceId, selectedContentId: null }),
  setSelectedContent: (contentId) => set({ selectedContentId: contentId }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  connectWebSocket: () => {
    const orgId = get().org?.id;
    const token = localStorage.getItem("access_token");
    if (!orgId || !token) return;

    const ws = new WebSocket(`ws://localhost:3001/api/v1/ws/${orgId}?token=${token}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "sync_complete":
          get().fetchServices();
          get().fetchContent();
          break;
        case "content_analyzed":
          get().fetchContent();
          break;
        case "moderation_action":
          get().fetchContent();
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(() => get().connectWebSocket(), 5000);
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  },
}));
