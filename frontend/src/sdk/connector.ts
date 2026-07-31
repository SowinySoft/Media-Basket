/**
 * MediaBasket Connector SDK — Gap 22
 *
 * TypeScript SDK for building custom connectors/plugins.
 *
 * Usage:
 *   import { ConnectorPlugin, ConnectorManifest, ContentItem } from '@mediabasket/connector-sdk';
 *
 *   export class MyConnector implements ConnectorPlugin {
 *     manifest: ConnectorManifest = { ... };
 *     async authenticate(config): Promise<AuthResult> { ... }
 *     async fetchContent(service, since?): Promise<ContentItem[]> { ... }
 *     async postContent(service, content): Promise<PostResult> { ... }
 *     async moderateContent(service, contentId, action): Promise<void> { ... }
 *   }
 */

// ── Types ──────────────────────────────────────────────────────────

export interface ConnectorManifest {
  name: string;
  display_name: string;
  version: string;
  description: string;
  icon: string; // URL or base64 SVG
  tier: "full" | "lightweight";
  capabilities: {
    read: boolean;
    write: boolean;
    moderate: boolean;
    analytics: boolean;
    webhooks: boolean;
  };
  auth: {
    type: "oauth2" | "api_key" | "bearer" | "basic";
    config_fields: AuthField[];
  };
  rate_limits?: {
    requests_per_minute?: number;
    requests_per_day?: number;
  };
}

export interface AuthField {
  name: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface AuthConfig {
  [key: string]: string;
}

export interface AuthResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  error?: string;
}

export interface ContentItem {
  external_id: string;
  content_type: "video" | "post" | "comment" | "message" | "story" | "tweet" | "pin" | "status" | "notification" | "unknown";
  title?: string;
  body?: string;
  author?: { name?: string; id?: string; avatar?: string };
  media?: { type: string; url: string }[];
  url?: string;
  platform_created_at?: string;
  likes?: number;
  comments_count?: number;
  shares?: number;
  views?: number;
}

export interface PostResult {
  success: boolean;
  external_id?: string;
  url?: string;
  error?: string;
}

export interface ServiceInstance {
  id: string;
  org_id: string;
  connector_type: string;
  display_name: string;
  config: AuthConfig;
}

// ── Plugin Interface ───────────────────────────────────────────────

export interface ConnectorPlugin {
  manifest: ConnectorManifest;

  /** Authenticate with the platform. Return tokens for later use. */
  authenticate(config: AuthConfig): Promise<AuthResult>;

  /** Fetch content from the platform. `since` is an ISO timestamp for incremental sync. */
  fetchContent(service: ServiceInstance, since?: string): Promise<ContentItem[]>;

  /** Post content to the platform (if write capability is enabled). */
  postContent(service: ServiceInstance, content: {
    title?: string;
    body?: string;
    media?: { type: string; url: string }[];
  }): Promise<PostResult>;

  /** Moderate content (approve, flag, delete, reply). */
  moderateContent(
    service: ServiceInstance,
    contentId: string,
    action: "approve" | "flag" | "delete" | "reply",
    message?: string,
  ): Promise<void>;

  /** Get analytics/metrics for the service (optional). */
  getAnalytics?(service: ServiceInstance, since?: string): Promise<Record<string, number>>;

  /** Handle an inbound webhook payload (optional). */
  handleWebhook?(payload: Record<string, any>): Promise<ContentItem[]>;
}

// ── Base class with default implementations ────────────────────────

export abstract class BaseConnector implements ConnectorPlugin {
  abstract manifest: ConnectorManifest;

  abstract authenticate(config: AuthConfig): Promise<AuthResult>;
  abstract fetchContent(service: ServiceInstance, since?: string): Promise<ContentItem[]>;

  async postContent(
    service: ServiceInstance,
    content: { title?: string; body?: string; media?: { type: string; url: string }[] },
  ): Promise<PostResult> {
    if (!this.manifest.capabilities.write) {
      return { success: false, error: "Write not supported by this connector" };
    }
    throw new Error("postContent not implemented");
  }

  async moderateContent(
    service: ServiceInstance,
    contentId: string,
    action: "approve" | "flag" | "delete" | "reply",
    message?: string,
  ): Promise<void> {
    if (!this.manifest.capabilities.moderate) {
      throw new Error("Moderation not supported by this connector");
    }
    throw new Error("moderateContent not implemented");
  }

  async getAnalytics(service: ServiceInstance, since?: string): Promise<Record<string, number>> {
    return {};
  }

  async handleWebhook(payload: Record<string, any>): Promise<ContentItem[]> {
    return [];
  }
}

// ── Helper utilities ───────────────────────────────────────────────

export function createManifest(opts: Omit<ConnectorManifest, "version"> & { version?: string }): ConnectorManifest {
  return {
    version: "1.0.0",
    ...opts,
  };
}

export function hashContent(externalId: string, connectorType: string, orgId: string): string {
  // Simple deterministic hash for dedup
  const payload = `${externalId}:${connectorType}:${orgId}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const chr = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
