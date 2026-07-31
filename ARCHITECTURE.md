# Media_Basket — System Architecture & Design Plan

> **Version:** 0.1.0 (Implemented)
> **Date:** 2026-07-31
> **Status:** ✅ IMPLEMENTED — All phases complete, all audit gaps resolved (30/30)

---

## Table of Contents

1. [Vision & Overview](#1-vision--overview)
2. [Personas & Use Cases](#2-personas--use-cases)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Technology Stack](#5-technology-stack)
6. [System Architecture Overview](#6-system-architecture-overview)
7. [Component Breakdown](#7-component-breakdown)
8. [Multi-Tenant Data Model](#8-multi-tenant-data-model)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Encrypted Credential Vault](#10-encrypted-credential-vault)
11. [Connector SDK — Plugin Architecture](#11-connector-sdk--plugin-architecture)
12. [Reference Connector Profiles](#12-reference-connector-profiles)
13. [Data Ingestion Pipeline](#13-data-ingestion-pipeline)
14. [Eventing & Real-Time](#14-eventing--real-time)
15. [Frontend Architecture](#15-frontend-architecture)
16. [API Surface](#16-api-surface)
17. [Database Schema](#17-database-schema)
18. [Deployment Architecture](#18-deployment-architecture)
19. [Observability & Monitoring](#19-observability--monitoring)
20. [Security Considerations](#20-security-considerations)
21. [Architecture Decision Records (ADRs)](#21-architecture-decision-records-adrs)
22. [Roadmap](#22-roadmap)
23. [Open Questions](#23-open-questions)

---

## 1. Vision & Overview

**Media_Basket** is a cloud-based, multi-tenant SaaS platform that aggregates multiple social media accounts into a single unified management interface. Think of it as a "Windows Explorer for your media presence."

The core metaphor is a **Basket** — a user's personal or organizational workspace containing nodes arranged in a tree view, where each node represents a connected media service (Facebook, YouTube, WhatsApp, X/Twitter, Reddit, Telegram, Instagram, LinkedIn, TikTok).

Users control which services to add, authenticate them via OAuth or API tokens, and interact with each service through a consistent interface — whether that's a fully integrated two-way API pipeline or a lightweight read-only data grep.

**Key Differentiators:**
- Tree-view navigation modeled after Windows Explorer
- Tiered integration depth: Full integration vs. lightweight pipeline
- Plugin-based connector SDK from day one
- Zero-knowledge credential vault with per-tenant encryption
- Multi-tenant SaaS with organizational workspaces

---

## 2. Personas & Use Cases

### 2.1 Primary Personas

| Persona | Description | Primary Goal |
|---------|-------------|--------------|
| **Content Creator** | Individual managing 3-10 social accounts | View all notifications, respond to comments, publish content from one dashboard |
| **Social Media Manager** | Professional managing client accounts | Moderate comments, schedule posts, track engagement across accounts |
| **Brand Manager** | Enterprise user monitoring brand presence | Aggregate mentions, sentiment, compliance across platforms |
| **Platform Administrator** | IT admin setting up org workspaces | Add/remove team members, configure service access, audit usage |

### 2.2 Core Use Cases

1. **Add Media Service** — User selects a platform from the service catalog, completes OAuth/token flow, service node appears in tree
2. **Browse & Navigate** — Click through tree nodes to view each service's dashboard/content/notifications
3. **Moderate Content** — Approve, delete, or flag content across platforms from a unified interface
4. **Manage Credentials** — Add, rotate, or revoke API tokens and OAuth refresh tokens via encrypted vault
5. **Team Collaboration** — Admin invites members; members see only their assigned service nodes
6. **Plugin Extension** — Developer writes a custom connector using the published SDK

---

## 3. Functional Requirements

### 3.1 Core

- **FR-01:** Tree-view navigation of connected media services
- **FR-02:** Add/remove media service nodes per user/org
- **FR-03:** OAuth 2.0 and API token authentication per service
- **FR-04:** Encrypted storage of all credentials (vault)
- **FR-05:** Settings page for credential management per service
- **FR-06:** Unified inbox for notifications across services
- **FR-07:** Content moderation actions (approve, delete, flag, hide)

### 3.2 Integration Tiers

- **FR-08:** Full Integration — bidirectional API (read + write + webhooks)
- **FR-09:** Lightweight Integration — read-only data ingestion (grep/poll)

### 3.3 Multi-Tenant

- **FR-10:** Organization workspaces with member management
- **FR-11:** Role-based access (Owner, Admin, Member, Viewer)
- **FR-12:** Per-service access control per member

### 3.4 Plugin System

- **FR-13:** Published Connector SDK for third-party plugins
- **FR-14:** Plugin manifest (JSON) declares capabilities, auth type, tier
- **FR-15:** Plugin sandbox isolation (no direct DB access)

---

## 4. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | API response time (p95) | < 200ms |
| NFR-02 | Ingestion latency (event → DB) | < 5s |
| NFR-03 | Availability | 99.9% |
| NFR-04 | Data retention | Configurable per org (default 90 days) |
| NFR-05 | Concurrent users | 10K+ per tenant cluster |
| NFR-06 | Plugin isolation | Zero shared state with host |
| NFR-07 | Encryption at rest | AES-256-GCM |
| NFR-08 | Encryption in transit | TLS 1.3 |
| NFR-09 | SOC 2 readiness | Phase 2 |
| NFR-10 | GDPR compliance | Right to deletion, data portability |

---

## 5. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (App Router) + TypeScript + React 18 | Server components for tree rendering; RSC reduces JS bundle |
| **Tree View** | `react-arborist` or custom virtualized tree | Proven Windows-Explorer-style tree component |
| **UI Kit** | Tailwind CSS + Radix UI primitives | Accessible, composable, no vendor lock-in |
| **Backend API** | NestJS (TypeScript) | Modular architecture, DI, decorator-driven plugins |
| **Auth** | NextAuth.js → NestJS JWT bridge | OAuth SSO + session management |
| **Database** | PostgreSQL 16 | Mature, JSONB for flexible connector data, Row-Level Security |
| **ORM** | Drizzle ORM | TypeScript-first, lightweight, type-safe SQL builder |
| **Cache** | Redis 7 | Session store, rate limit counters, pub/sub for events |
| **Message Queue** | BullMQ (Redis-backed) | Job scheduling for ingestion, retry, webhook fan-out |
| **Object Storage** | S3-compatible (AWS S3 or MinIO) | Media attachments, plugin assets, backups |
| **KMS** | AWS KMS (or Vault Transit) | Per-tenant master key envelope encryption |
| **Container Runtime** | Docker + Docker Compose (dev) / Kubernetes (prod) | Consistent environments, horizontal scaling |
| **CI/CD** | GitHub Actions | Build, test, deploy pipeline |
| **Monitoring** | OpenTelemetry + Grafana + Prometheus | Distributed tracing, metrics, dashboards |
| **Logging** | Pino (structured JSON) → Loki | High-performance structured logs |
| **Email/Notifications** | Resend (transactional) + WebSocket (real-time) | Reliable delivery + instant push |

---

## 6. System Architecture Overview

### 6.1 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client Layer"]
        WEB["Next.js Frontend<br/>(Tree View + Dashboards)"]
    end

    subgraph API["API Layer"]
        GW["API Gateway<br/>(Rate Limit + Auth)"]
        NEST["NestJS Backend<br/>(REST + WebSocket)"]
    end

    subgraph Services["Service Layer"]
        AUTH_SVC["Auth Service"]
        VAULT_SVC["Credential Vault"]
        TREE_SVC["Tree Service"]
        INGEST_SVC["Ingestion Pipeline"]
        MOD_SVC["Moderation Engine"]
        PLUGIN_SVC["Plugin Runtime"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL 16<br/>(Primary + Read Replica)")]
        REDIS[("Redis 7<br/>(Cache + Queue + PubSub)")]
        S3["S3 Storage<br/>(Media + Assets)"]
        KMS["AWS KMS<br/>(Encryption Keys)"]
    end

    subgraph External["External Services"]
        YT["YouTube API"]
        FB["Meta Graph API"]
        WA["WhatsApp Cloud API"]
        X["X/Twitter API"]
        RD["Reddit API"]
        TG["Telegram Bot API"]
        IG["Instagram API"]
        LI["LinkedIn API"]
        TT["TikTok API"]
        OTHER["3rd-Party Plugins"]
    end

    WEB --> GW
    GW --> NEST
    NEST --> AUTH_SVC
    NEST --> VAULT_SVC
    NEST --> TREE_SVC
    NEST --> INGEST_SVC
    NEST --> MOD_SVC
    NEST --> PLUGIN_SVC

    AUTH_SVC --> PG
    AUTH_SVC --> REDIS
    VAULT_SVC --> KMS
    VAULT_SVC --> PG
    TREE_SVC --> PG
    INGEST_SVC --> REDIS
    INGEST_SVC --> PG
    INGEST_SVC --> S3
    MOD_SVC --> PG
    PLUGIN_SVC --> REDIS

    INGEST_SVC --> YT
    INGEST_SVC --> FB
    INGEST_SVC --> WA
    INGEST_SVC --> X
    INGEST_SVC --> RD
    INGEST_SVC --> TG
    INGEST_SVC --> IG
    INGEST_SVC --> LI
    INGEST_SVC --> TT
    PLUGIN_SVC --> OTHER
```

### 6.2 Data Flow — Add a Service

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as NestJS API
    participant VS as Vault Service
    participant KMS as AWS KMS
    participant IS as Ingestion Service
    participant EXT as External API

    U->>FE: Click "Add YouTube"
    FE->>API: POST /services {type: "youtube"}
    API->>API: Generate OAuth state + PKCE
    API-->>FE: Return OAuth URL
    FE->>U: Redirect to Google OAuth
    U->>Google: Authorize
    Google-->>FE: Callback with code
    FE->>API: POST /services/youtube/callback {code, state}
    API->>EXT: Exchange code for tokens
    EXT-->>API: access_token + refresh_token
    API->>VS: Encrypt tokens with tenant key
    VS->>KMS: Generate DEK, encrypt with KEK
    KMS-->>VS: Encrypted DEK + ciphertext
    VS->>API: Store encrypted tokens
    API->>IS: Schedule initial sync job
    IS->>EXT: Fetch channel data, recent videos
    EXT-->>IS: Data payload
    IS->>API: Store normalized data
    API-->>FE: Service added, node in tree
    FE->>U: YouTube node appears in tree
```

### 6.3 Data Flow — Ingestion Pipeline

```mermaid
graph LR
    subgraph IngestionPipeline["Ingestion Pipeline"]
        direction TB
        POLL["Poll Manager<br/>(Cron + Interval)"]
        WEBHOOK["Webhook Receiver<br/>(Inbound Events)"]
        QUEUE["BullMQ Workers<br/>(Concurrency Pool)"]
        NORMALIZE["Normalizer<br/>(Schema Transform)"]
        DEDUP["Deduplicator<br/>(Content Hash)"]
        STORE["Data Store<br/>(PostgreSQL + S3)"]
        EMIT["Event Emitter<br/>(Redis Pub/Sub)"]
    end

    EXT_API["External APIs"] --> POLL
    EXT_API --> WEBHOOK
    POLL --> QUEUE
    WEBHOOK --> QUEUE
    QUEUE --> NORMALIZE
    NORMALIZE --> DEDUP
    DEDUP --> STORE
    STORE --> EMIT
    EMIT --> WS["WebSocket<br/>(Real-time UI)"]
    EMIT --> ALERT["Alert Rules<br/>(Notification)"]
```

---

## 7. Component Breakdown

### 7.1 API Gateway (NestJS — edge module)

- Rate limiting per tenant (token bucket in Redis)
- JWT validation + tenant context injection
- CORS, request logging, health checks
- WebSocket upgrade proxy

### 7.2 Auth Service

- NextAuth.js for SSO login (Google, GitHub, email magic link)
- JWT session tokens with tenant_id + user_id + roles
- RBAC: Owner → Admin → Member → Viewer
- OAuth state management for provider flows

### 7.3 Tree Service

- CRUD operations on the service tree per user/org
- Tree nodes: ServiceNode { id, type, parentId, config, status, metadata }
- Positional ordering (nested set or materialized path)
- Shared vs. private nodes
- Real-time updates via WebSocket when services change

### 7.4 Credential Vault

- Per-tenant encryption keys managed via KMS envelope encryption
- Data Encryption Key (DEK) per credential, wrapped by KMS Key Encryption Key (KEK)
- Credentials stored as: { tenant_id, service_id, encrypted_blob, iv, tag, dek_ciphertext }
- Zero-knowledge: server cannot decrypt without user's master passphrase OR KMS
- Token rotation support with versioning
- Audit log for all vault access

### 7.5 Ingestion Service

- BullMQ workers for scheduled polling
- Per-service rate limit compliance (respects X-RateLimit headers)
- Webhook endpoint for services that support it (YouTube, Facebook)
- Normalization layer: each connector defines a `normalize()` function
- Content hashing for deduplication (SHA-256 of normalized payload)
- Configurable sync intervals per service

### 7.6 Moderation Engine

- Unified content model: Post, Comment, Message, Mention, Review
- Action dispatch: approve, delete, flag, hide, respond
- Platform-specific action mapping (connector defines action handlers)
- Bulk operations with confirmation
- Audit trail for all moderation actions

### 7.7 Plugin Runtime

- Plugin manifest: `media-basket-plugin.json`
- Sandboxed execution (Node.js worker_threads or isolated process)
- SDK published as `@media-basket/connector-sdk`
- Plugin → Host interface: `ConnectorPlugin`
- Capability declaration: `{ reads: [...], writes: [...], webhooks: bool }`

---

## 8. Multi-Tenant Data Model

```mermaid
erDiagram
    ORGANIZATION ||--o{ MEMBER : has
    MEMBER ||--o{ SERVICE_INSTANCE : owns
    ORGANIZATION ||--o{ SERVICE_INSTANCE : contains
    SERVICE_INSTANCE ||--o| CREDENTIAL_VAULT : stores
    SERVICE_INSTANCE ||--o{ CONTENT_ITEM : ingests
    SERVICE_INSTANCE ||--o{ SYNC_JOB : schedules
    SERVICE_INSTANCE ||--o{ MODERATION_ACTION : records
    SERVICE_INSTANCE }o--|| CONNECTOR_TYPE : references
    MEMBER }o--|| USER : is
    USER ||--o{ SESSION : authenticates

    ORGANIZATION {
        uuid id PK
        string name
        jsonb settings
        timestamp created_at
    }

    USER {
        uuid id PK
        string email
        string display_name
        jsonb preferences
        timestamp created_at
    }

    MEMBER {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        enum role
        jsonb service_permissions
        timestamp joined_at
    }

    CONNECTOR_TYPE {
        string name PK
        string display_name
        enum tier
        jsonb capabilities
        string manifest_version
        bool enabled
    }

    SERVICE_INSTANCE {
        uuid id PK
        uuid org_id FK
        uuid member_id FK
        string connector_type FK
        string display_name
        jsonb config
        enum status
        timestamp last_synced_at
        timestamp created_at
    }

    CREDENTIAL_VAULT {
        uuid id PK
        uuid service_instance_id FK
        bytes encrypted_blob
        bytes iv
        bytes tag
        bytes dek_ciphertext
        int version
        timestamp rotated_at
    }

    CONTENT_ITEM {
        uuid id PK
        uuid service_instance_id FK
        string external_id
        enum content_type
        jsonb payload
        string content_hash
        timestamp ingested_at
        timestamp updated_at
    }

    SYNC_JOB {
        uuid id PK
        uuid service_instance_id FK
        enum status
        jsonb result
        timestamp started_at
        timestamp completed_at
    }

    MODERATION_ACTION {
        uuid id PK
        uuid service_instance_id FK
        uuid member_id FK
        string content_item_id FK
        enum action
        jsonb details
        timestamp performed_at
    }

    SESSION {
        uuid id PK
        uuid user_id FK
        string token_hash
        timestamp expires_at
        timestamp created_at
    }
```

### 8.1 Row-Level Security (RLS)

Every query is scoped to `tenant_id` via PostgreSQL RLS policies:

```sql
-- All tables inherit a tenant_id (org_id) column
ALTER TABLE service_instance ADD COLUMN org_id UUID NOT NULL;

-- RLS policy
CREATE POLICY tenant_isolation ON service_instance
    USING (org_id = current_setting('app.current_tenant')::UUID);

-- Application sets the tenant context per request
SET LOCAL app.current_tenant = '<org-uuid>';
```

---

## 9. Authentication & Authorization

### 9.1 Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant NA as NextAuth
    participant API as NestJS

    U->>FE: Click "Sign In"
    FE->>NA: Initiate OAuth / Magic Link
    NA-->>FE: Session token
    FE->>API: Request + Authorization: Bearer <token>
    API->>API: Validate JWT, extract tenant_id + roles
    API-->>FE: Authorized response
```

### 9.2 RBAC Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Manage org settings | ✅ | ❌ | ❌ | ❌ |
| Add/remove services | ✅ | ✅ | ❌ | ❌ |
| Add/remove members | ✅ | ✅ | ❌ | ❌ |
| Moderate content | ✅ | ✅ | ✅ | ❌ |
| View dashboards | ✅ | ✅ | ✅ | ✅ |
| Rotate credentials | ✅ | ✅ | ❌ | ❌ |
| Manage plugin config | ✅ | ✅ | ❌ | ❌ |

---

## 10. Encrypted Credential Vault

### 10.1 Envelope Encryption Design

```mermaid
graph TD
    subgraph EnvelopeEncryption["Envelope Encryption"]
        MASTER["Master Key (KEK)<br/>AWS KMS CMK"]
        DEK["Data Encryption Key<br/>Per Credential"]
        BLOB["Encrypted Credential<br/>AES-256-GCM"]
    end

    CREDS["Plaintext Credentials<br/>(OAuth tokens, API keys)"] -->|"Encrypt with DEK"| BLOB
    DEK -->|"Encrypt with KEK"| WRAPPED["Wrapped DEK<br/>(KMS ciphertext)"]
    BLOB --> VAULT_ROW["Vault Row:<br/>encrypted_blob + iv + tag + dek_ciphertext"]
    WRAPPED --> VAULT_ROW

    KMS_CALL["AWS KMS<br/>Decrypt(wrapped_dek)"] -->|"Returns DEK"| UNWRAP["Decrypt BLOB"]
    VAULT_ROW -->|"Load row"| UNWRAP
    KMS_CALL -.->|"Only called<br/>on read"| UNWRAP
```

### 10.2 Credential Lifecycle

| State | Description |
|-------|-------------|
| `active` | Valid, usable |
| `expired` | Token past expiry, needs refresh |
| `revoked` | Manually revoked by user |
| `rotating` | New token being obtained |
| `error` | Refresh failed, needs re-auth |

### 10.3 Audit Trail

Every vault access (read, write, rotate, revoke) logs:
- `user_id`, `org_id`, `service_id`
- `action` (read / write / rotate / revoke)
- `timestamp`, `ip_address`, `user_agent`
- Stored in append-only `vault_audit_log` table

---

## 11. Connector SDK — Plugin Architecture

### 11.1 SDK Package: `@media-basket/connector-sdk`

```typescript
// Connector SDK — published as @media-basket/connector-sdk

export interface ConnectorManifest {
  name: string;              // Unique identifier, e.g. "youtube"
  displayName: string;       // Human-readable: "YouTube"
  version: string;           // Semver
  tier: 'full' | 'lightweight';
  icon: string;              // SVG path or URL
  capabilities: {
    reads: DataType[];       // ['videos', 'comments', 'analytics']
    writes: DataType[];      // ['comments', 'videos'] — lightweight may be []
    webhooks: boolean;
    pollInterval: string;    // e.g. "5m", "1h"
  };
  auth: {
    type: 'oauth2' | 'api_token' | 'cookie' | 'bot_token';
    scopes?: string[];       // OAuth scopes required
    tokenUrl?: string;
    authUrl?: string;
  };
}

export type DataType =
  | 'posts' | 'comments' | 'messages' | 'mentions'
  | 'videos' | 'analytics' | 'subscribers' | 'reviews'
  | 'notifications' | 'media' | 'followers';

export interface ConnectorPlugin {
  manifest: ConnectorManifest;

  // Lifecycle
  initialize(config: ConnectorConfig): Promise<void>;
  shutdown(): Promise<void>;

  // Auth
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenPair>;
  refreshToken(refreshToken: string): Promise<TokenPair>;

  // Data (reads)
  fetch(params: FetchParams): Promise<NormalizedPayload>;
  fetchOne(id: string): Promise<NormalizedPayload>;

  // Actions (writes — full tier only)
  moderate(action: ModerationAction): Promise<ModerationResult>;
  respond(contentId: string, message: string): Promise<void>;

  // Webhooks (if supported)
  verifyWebhook(signature: string, body: Buffer): boolean;
  parseWebhook(body: Buffer): WebhookEvent;
}
```

### 11.2 Plugin Loading Architecture

```mermaid
graph TB
    subgraph PluginSystem["Plugin System"]
        REGISTRY["Plugin Registry<br/>(DB + Filesystem)"]
        LOADER["Plugin Loader<br/>(Node.js worker_threads)"]
        SANDBOX["Sandbox<br/>(Isolated Context)"]
        HOST["Host Interface<br/>(Message Channel)"]
    end

    BUILTIN["Built-in Connectors<br/>(YouTube, Meta, X, etc.)"] --> REGISTRY
    CUSTOM["Custom Plugins<br/>(3rd-party)"] -->|"npm install + register"| REGISTRY
    REGISTRY --> LOADER
    LOADER --> SANDBOX
    SANDBOX -->|"MessageChannel"| HOST
    HOST --> INGEST["Ingestion Pipeline"]
    HOST --> MODERATE["Moderation Engine"]
```

### 11.3 Plugin Manifest File

```json
{
  "name": "my-custom-connector",
  "displayName": "My Custom Service",
  "version": "1.0.0",
  "tier": "lightweight",
  "entry": "./dist/connector.js",
  "capabilities": {
    "reads": ["posts", "comments"],
    "writes": [],
    "webhooks": false,
    "pollInterval": "15m"
  },
  "auth": {
    "type": "api_token"
  },
  "permissions": ["network:outbound"]
}
```

---

## 12. Reference Connector Profiles

### 12.1 Connector Comparison Matrix

| Service | Tier | Auth Type | Reads | Writes | Webhooks | Poll Interval | Complexity |
|---------|------|-----------|-------|--------|----------|---------------|------------|
| **YouTube** | Full | OAuth 2.0 | Videos, Comments, Analytics, Subscribers | Comment replies, Video metadata | ✅ | 5m | Medium |
| **Meta (FB + IG)** | Full | OAuth 2.0 | Posts, Comments, Messages, Insights | Comment replies, Post actions | ✅ | 5m | High |
| **WhatsApp Business** | Full | Bearer Token | Messages, Media, Contacts | Send messages, Templates | ✅ | Real-time | Medium |
| **X / Twitter** | Full | OAuth 2.0 + PKCE | Posts, DMs, Mentions, Analytics | Post, Reply, Delete, DM | ✅ | 5m | Medium |
| **Reddit** | Full | OAuth 2.0 | Posts, Comments, Mod Queue | Reply, Approve, Remove | ✅ | 5m | Medium |
| **Telegram Bot** | Full | Bot Token | Messages, Callbacks | Send messages, Media | ✅ | Real-time | Low |
| **Instagram** | Full | OAuth 2.0 (via Meta) | Posts, Stories, Comments, Insights | Reply, Media actions | ✅ | 10m | High |
| **LinkedIn** | Lightweight | OAuth 2.0 | Posts, Comments, Profile | Post content | ❌ | 15m | Medium |
| **TikTok** | Full | OAuth 2.0 | Videos, Comments, Analytics | Upload, Comment reply | ✅ | 10m | High |

### 12.2 Per-Connector Details

#### YouTube

```
API:         YouTube Data API v3 + YouTube Analytics API
Auth:        OAuth 2.0 (Google Cloud Console)
Scopes:      youtube.readonly, youtube.force-ssl, youtube.analytics.readonly
Rate Limit:  10,000 units/day (default quota)
Webhooks:    Pub/Sub (push notifications for new videos)
Writes:      Comment moderation (approve/flag/delete), playlist management
Data Model:  Channel → Videos → Comments → Replies
```

#### Meta (Facebook + Instagram)

```
API:         Meta Graph API
Auth:        OAuth 2.0 (Facebook Login)
Scopes:      pages_show_list, pages_manage_posts, pages_read_engagement,
             instagram_basic, instagram_manage_messages
Rate Limit:  200 calls/user/hour (varies by endpoint)
Webhooks:    Graph Subscriptions (page notifications, comments, messages)
Writes:      Comment replies, post hiding, message responses
Data Model:  Page → Posts → Comments / Messages / Insights
```

#### WhatsApp Business Cloud API

```
API:         WhatsApp Business Platform (Cloud API)
Auth:        Permanent System User Token + App Secret
Rate Limit:  80 messages/second (per phone number)
Webhooks:    Mandatory (message delivery, read receipts)
Writes:      Send text/media/template messages, mark as read
Data Model:  Phone Number → Conversations → Messages → Media
Note:        Personal WhatsApp access is NOT supported (TOS violation)
```

#### X / Twitter API v2

```
API:         Twitter API v2 (Free / Basic / Pro / Enterprise tiers)
Auth:        OAuth 2.0 PKCE (preferred) or OAuth 1.0a
Scopes:      tweet.read, tweet.write, users.read, dm.read, dm.write
Rate Limit:  15 requests/15min (free), 60 (basic), 300 (pro)
Webhooks:    Account Activity API (Basic tier+)
Writes:      Tweet, Reply, Delete, DM, Bookmark
Data Model:  User → Tweets → Replies / Likes / Retweets / DMs
```

#### Reddit

```
API:         Reddit API (OAuth2)
Auth:        OAuth 2.0 (script or web app type)
Scopes:      read, submit, moderate, mysubreddits
Rate Limit:  60 requests/minute
Webhooks:    Reddit does not offer webhooks — poll only
Writes:      Comment, Approve, Remove, Ban, Flair
Data Model:  Subreddit → Posts → Comments → Mod Queue
```

#### Telegram Bot API

```
API:         Telegram Bot API
Auth:        Bot Token (obtained via @BotFather)
Rate Limit:  30 messages/second per bot, 20 messages/minute to same chat
Webhooks:    Set via setWebhook — real-time delivery
Writes:      Send messages, media, stickers, inline keyboards
Data Model:  Chat → Messages → Callbacks
Note:        For full user-account access, MTProto (TDLib) is needed
```

#### Instagram (via Meta Graph API)

```
API:         Instagram Graph API (Business/Creator accounts only)
Auth:        OAuth 2.0 (via Facebook Login, linked to Meta page)
Scopes:      instagram_basic, instagram_manage_comments, instagram_manage_insights
Rate Limit:  Same as Meta Graph API (200 calls/user/hour)
Webhooks:    Via Graph Subscriptions (comments, stories)
Writes:      Reply to comments, hide/remove comments
Data Model:  Business Account → Media → Comments / Insights / Stories
```

#### LinkedIn

```
API:         LinkedIn Marketing API + Share on LinkedIn
Auth:        OAuth 2.0
Scopes:      w_member_social, r_liteprofile, r_emailaddress
Rate Limit:  100 requests/day (application-level)
Webhooks:    None — lightweight only
Writes:      Post content (limited to shares)
Data Model:  Profile → Posts → Comments
Note:        API surface is intentionally limited by LinkedIn
```

#### TikTok

```
API:         TikTok Content Posting API + Display API
Auth:        OAuth 2.0
Scopes:      video.upload, user.info.basic, video.list
Rate Limit:  1,000 requests/day
Webhooks:    Limited webhook support (video status)
Writes:      Upload video, comment on videos
Data Model:  User → Videos → Comments → Analytics
```

---

## 13. Data Ingestion Pipeline

### 13.1 Pipeline Stages

```mermaid
graph LR
    S1["1. Trigger<br/>(Poll / Webhook)"]
    S2["2. Fetch<br/>(API Call)"]
    S3["3. Normalize<br/>(Schema Transform)"]
    S4["4. Deduplicate<br/>(Content Hash)"]
    S5["5. Enrich<br/>(Attach Metadata)"]
    S6["6. Store<br/>(PostgreSQL + S3)"]
    S7["7. Emit<br/>(Event + WebSocket)"]
    S8["8. Alert<br/>(Notification Rules)"]

    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8
```

### 13.2 Normalization Schema

Every connector's `normalize()` function must return:

```typescript
interface NormalizedPayload {
  connectorType: string;           // 'youtube', 'facebook', etc.
  serviceInstanceId: string;       // FK to service_instance
  externalId: string;              // Platform-specific ID
  contentType: DataType;           // 'post', 'comment', 'message', etc.
  contentHash: string;             // SHA-256 for dedup
  payload: {
    title?: string;
    body?: string;
    author?: { id: string; name: string; avatar?: string };
    media?: { type: string; url: string; mimeType: string }[];
    metrics?: { likes?: number; views?: number; shares?: number };
    timestamps: { created: string; updated?: string };
    raw: Record<string, unknown>;  // Full API response for future use
  };
  moderation?: {
    status: 'none' | 'flagged' | 'approved' | 'removed';
    reasons?: string[];
  };
}
```

### 13.3 Rate Limit Management

Each connector maintains a per-tenant rate limit state in Redis:

```
Key:    rate_limit:{tenant_id}:{connector_type}
Fields: remaining, limit, reset_at
Logic:  If remaining < threshold → backoff to next reset_at
```

For connectors with tiered quotas (X/Twitter Free vs. Pro), the connector reads the org's plan tier to determine the correct limit.

---

## 14. Eventing & Real-Time

### 14.1 Event Types

```typescript
enum EventType {
  // Service events
  SERVICE_CONNECTED = 'service.connected',
  SERVICE_DISCONNECTED = 'service.disconnected',
  SERVICE_SYNC_COMPLETE = 'service.sync.complete',
  SERVICE_ERROR = 'service.error',

  // Content events
  CONTENT_NEW = 'content.new',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_FLAGGED = 'content.flagged',
  CONTENT_REMOVED = 'content.removed',

  // Moderation events
  MODERATION_ACTION_PERFORMED = 'moderation.action.performed',

  // Plugin events
  PLUGIN_LOADED = 'plugin.loaded',
  PLUGIN_ERROR = 'plugin.error',

  // System events
  CREDENTIAL_ROTATED = 'credential.rotated',
  CREDENTIAL_EXPIRED = 'credential.expired',
}
```

### 14.2 Real-Time Architecture

```mermaid
sequenceDiagram
    participant EXT as External API
    participant INGEST as Ingestion Worker
    participant REDIS as Redis Pub/Sub
    participant API as NestJS WebSocket
    participant FE as Frontend

    INGEST->>REDIS: Publish content.new event
    REDIS->>API: Fan-out to all API instances
    API->>API: Filter by tenant_id subscription
    API->>FE: WebSocket message: content.new
    FE->>FE: Update tree node badge count
    FE->>FE: Show toast notification
```

---

## 15. Frontend Architecture

### 15.1 Page Structure

```
app/
├── layout.tsx                     # Root layout (sidebar + topbar)
├── page.tsx                       # Dashboard (aggregated view)
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/
│   ├── layout.tsx                 # Authenticated layout
│   ├── tree/
│   │   └── page.tsx               # Tree view (main explorer)
│   ├── service/
│   │   └── [id]/
│   │       ├── page.tsx           # Service dashboard
│   │       ├── content/page.tsx   # Content browser
│   │       ├── moderate/page.tsx  # Moderation queue
│   │       └── analytics/page.tsx # Analytics view
│   ├── inbox/
│   │   └── page.tsx               # Unified inbox
│   ├── settings/
│   │   ├── page.tsx               # Org settings
│   │   ├── services/page.tsx      # Service catalog + management
│   │   ├── credentials/page.tsx   # Vault management
│   │   ├── members/page.tsx       # Team management
│   │   └── plugins/page.tsx       # Plugin marketplace
│   └── admin/
│       └── page.tsx               # Platform admin (super-admin)
└── components/
    ├── tree/
    │   ├── TreeView.tsx           # Main tree component
    │   ├── TreeNode.tsx           # Individual node
    │   ├── ServiceNode.tsx        # Service-specific node
    │   ├── TreeNodeBadge.tsx      # Notification count badge
    │   └── TreeNodeContextMenu.tsx
    ├── dashboard/
    │   ├── ServiceCard.tsx
    │   ├── ActivityFeed.tsx
    │   └── MetricWidget.tsx
    ├── moderation/
    │   ├── ContentCard.tsx
    │   ├── ModerationToolbar.tsx
    │   └── BulkActionDialog.tsx
    └── settings/
        ├── CredentialForm.tsx
        ├── OAuthCallback.tsx
        └── PluginConfigPanel.tsx
```

### 15.2 Tree View Component Design

```mermaid
graph TB
    subgraph TreeView["Windows Explorer Tree View"]
        ROOT["🏛️ My Organization"]
        ROOT --> FB_NODE["📘 Facebook<br/>🔵 Connected<br/>3 new"]
        ROOT --> YT_NODE["📺 YouTube<br/>🟢 Connected<br/>12 new"]
        ROOT --> WA_NODE["💬 WhatsApp<br/>🟡 Token Expiring"]
        ROOT --> X_NODE["🐦 X/Twitter<br/>🔴 Disconnected"]
        ROOT --> RD_NODE["🔷 Reddit<br/>🟢 Connected"]
        ROOT --> TG_NODE["✈️ Telegram<br/>🟢 Connected"]
        ROOT --> IG_NODE["📸 Instagram<br/>🟢 Connected"]
        ROOT --> LI_NODE["💼 LinkedIn<br/>⚪ Lightweight"]
        ROOT --> TT_NODE["🎵 TikTok<br/>🟢 Connected"]
        ROOT --> MORE_NODE["➕ Add Service..."]

        YT_NODE --> YT_VIDEOS["📹 Videos"]
        YT_NODE --> YT_COMMENTS["💬 Comments"]
        YT_NODE --> YT_ANALYTICS["📊 Analytics"]
        YT_NODE --> YT_SETTINGS["⚙️ Settings"]

        YT_COMMENTS --> YT_C1["Comment: \"Great video!\""]
        YT_COMMENTS --> YT_C2["Comment: \"Need more...\""]
    end
```

### 15.3 Tree State Management

- **Server-side:** Tree structure stored in PostgreSQL, fetched via tRPC
- **Client-side:** Zustand store for tree state, selection, expanded nodes
- **Optimistic updates:** Add/remove nodes with rollback on error
- **Virtualization:** `react-arborist` virtualizes large trees (1000+ nodes)

### 15.4 Real-Time UI Updates

```typescript
// WebSocket handler on client
useEffect(() => {
  const ws = useWebSocket(`/ws?token=${sessionToken}`);

  ws.on('service.connected', (data) => {
    treeStore.addNode(data.serviceInstance);
    toast.success(`${data.displayName} connected!`);
  });

  ws.on('content.new', (data) => {
    treeStore.updateBadge(data.serviceInstanceId, +1);
    showNotification(data);
  });

  ws.on('service.error', (data) => {
    treeStore.setStatus(data.serviceInstanceId, 'error');
    toast.error(`${data.displayName}: ${data.message}`);
  });
}, []);
```

---

## 16. API Surface

### 16.1 REST Endpoints

```
# Organization
GET    /api/v1/orgs/:orgId
PUT    /api/v1/orgs/:orgId

# Members
GET    /api/v1/orgs/:orgId/members
POST   /api/v1/orgs/:orgId/members
DELETE /api/v1/orgs/:orgId/members/:memberId
PATCH  /api/v1/orgs/:orgId/members/:memberId/role

# Services
GET    /api/v1/orgs/:orgId/services          # List all services in tree
POST   /api/v1/orgs/:orgId/services          # Add new service (initiates OAuth)
GET    /api/v1/orgs/:orgId/services/:id
DELETE /api/v1/orgs/:orgId/services/:id
PATCH  /api/v1/orgs/:orgId/services/:id

# OAuth Callbacks
GET    /api/v1/services/:type/auth-url       # Get OAuth URL
POST   /api/v1/services/:type/callback       # Complete OAuth flow

# Content
GET    /api/v1/orgs/:orgId/services/:id/content
GET    /api/v1/orgs/:orgId/content           # Cross-service feed

# Moderation
POST   /api/v1/orgs/:orgId/services/:id/content/:contentId/moderate
POST   /api/v1/orgs/:orgId/content/bulk-moderate

# Credentials
GET    /api/v1/orgs/:orgId/services/:id/credentials
POST   /api/v1/orgs/:orgId/services/:id/credentials
DELETE /api/v1/orgs/:orgId/services/:id/credentials
POST   /api/v1/orgs/:orgId/services/:id/credentials/rotate

# Plugins
GET    /api/v1/plugins
POST   /api/v1/plugins
DELETE /api/v1/plugins/:id
POST   /api/v1/plugins/:id/activate

# Webhooks (inbound from external services)
POST   /api/v1/webhooks/:type/:orgId/:serviceId

# Health
GET    /api/v1/health
GET    /api/v1/health/ready
```

### 16.2 WebSocket Channels

```
Connection: wss://api.mediabasket.app/ws?token=<jwt>

// Subscribe to org events
{ "action": "subscribe", "channel": "org:{orgId}" }

// Events received:
{ "event": "content.new", "data": { ... } }
{ "event": "service.connected", "data": { ... } }
{ "event": "service.error", "data": { ... } }
{ "event": "moderation.action.performed", "data": { ... } }
```

---

## 17. Database Schema

### 17.1 Core Tables (Drizzle ORM)

```typescript
// schema/organizations.ts
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// schema/members.ts
export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: enum('role', ['owner', 'admin', 'member', 'viewer']).notNull(),
  servicePermissions: jsonb('service_permissions').default({}),
  joinedAt: timestamp('joined_at').defaultNow(),
});

// schema/services.ts
export const serviceInstances = pgTable('service_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  memberId: uuid('member_id').references(() => members.id).notNull(),
  connectorType: varchar('connector_type', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  config: jsonb('config').default({}),
  status: enum('status', ['active', 'expired', 'error', 'disconnected']).default('active'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// schema/credentials.ts
export const credentialVault = pgTable('credential_vault', {
  id: uuid('id').defaultRandom().primaryKey(),
  serviceInstanceId: uuid('service_instance_id')
    .references(() => serviceInstances.id).notNull(),
  encryptedBlob: bytea('encrypted_blob').notNull(),
  iv: bytea('iv').notNull(),
  tag: bytea('tag').notNull(),
  dekCiphertext: bytea('dek_ciphertext').notNull(),
  version: integer('version').default(1),
  rotatedAt: timestamp('rotated_at').defaultNow(),
});

// schema/content.ts
export const contentItems = pgTable('content_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  serviceInstanceId: uuid('service_instance_id')
    .references(() => serviceInstances.id).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  contentType: enum('content_type', [
    'post', 'comment', 'message', 'mention',
    'video', 'review', 'notification'
  ]).notNull(),
  payload: jsonb('payload').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  ingestedAt: timestamp('ingested_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// schema/moderation.ts
export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  serviceInstanceId: uuid('service_instance_id')
    .references(() => serviceInstances.id).notNull(),
  memberId: uuid('member_id').references(() => members.id).notNull(),
  contentItemId: uuid('content_item_id')
    .references(() => contentItems.id).notNull(),
  action: enum('action', [
    'approve', 'delete', 'flag', 'hide', 'respond'
  ]).notNull(),
  details: jsonb('details'),
  performedAt: timestamp('performed_at').defaultNow(),
});

// schema/vault_audit.ts
export const vaultAuditLog = pgTable('vault_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  serviceId: uuid('service_id').references(() => serviceInstances.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow(),
});
```

---

## 18. Deployment Architecture

### 18.1 Production (Kubernetes)

```mermaid
graph TB
    subgraph K8S["Kubernetes Cluster"]
        subgraph FrontendNs["frontend namespace"]
            NEXT["Next.js App<br/>(3 replicas)"]
            CDN["CloudFront CDN"]
        end

        subgraph ApiNs["api namespace"]
            NEST1["NestJS API<br/>(3 replicas)"]
            NEST2["NestJS API<br/>(auto-scale)"]
        end

        subgraph WorkerNs["worker namespace"]
            W1["Ingestion Workers<br/>(2-10 replicas)"]
            W2["Moderation Workers<br/>(1-4 replicas)"]
        end

        subgraph DataNs["data namespace"]
            PG_PRIMARY["PostgreSQL<br/>(Primary)"]
            PG_REPLICA["PostgreSQL<br/>(Read Replica)"]
            REDIS_MASTER["Redis<br/>(Master)"]
            REDIS_REPLICA["Redis<br/>(Sentinel)"]
        end
    end

    CDN --> NEXT
    NEXT --> NEST1
    NEXT --> NEST2
    NEST1 --> PG_PRIMARY
    NEST2 --> PG_REPLICA
    NEST1 --> REDIS_MASTER
    W1 --> PG_PRIMARY
    W1 --> REDIS_MASTER
    PG_PRIMARY --> PG_REPLICA
```

### 18.2 Docker Compose (Development / Self-Hosted)

```yaml
# docker-compose.yml (simplified)
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: media_basket
      POSTGRES_PASSWORD: dev_password
    ports: ['5432:5432']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  api:
    build: ./apps/api
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://postgres:dev_password@postgres/media_basket
      REDIS_URL: redis://redis:6379
      KMS_ENDPOINT: http://localstack:4566
    ports: ['3001:3001']

  web:
    build: ./apps/web
    depends_on: [api]
    ports: ['3000:3000']

  worker:
    build: ./apps/worker
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://postgres:dev_password@postgres/media_basket
      REDIS_URL: redis://redis:6379
    replicas: 2

  localstack:
    image: localstack/localstack
    ports: ['4566:4566']  # Local KMS

volumes:
  pgdata:
```

---

## 19. Observability & Monitoring

### 19.1 Metrics (OpenTelemetry + Prometheus)

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_seconds` | Histogram | method, path, status, tenant_id |
| `ingestion_job_duration_seconds` | Histogram | connector_type, tenant_id |
| `ingestion_job_total` | Counter | connector_type, status, tenant_id |
| `credential_expiry_seconds` | Gauge | service_instance_id, connector_type |
| `vault_access_total` | Counter | action, tenant_id, user_id |
| `plugin_load_duration_seconds` | Histogram | plugin_name |
| `ws_connections_active` | Gauge | tenant_id |
| `rate_limit_remaining` | Gauge | tenant_id, connector_type |

### 19.2 Structured Logging

```typescript
// Pino structured logging
logger.info({
  event: 'ingestion_complete',
  tenantId: tenantId,
  connectorType: 'youtube',
  itemsIngested: 42,
  duplicatesSkipped: 3,
  durationMs: 1250,
  jobId: job.id,
});
```

### 19.3 Alerting Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | 5xx > 1% for 5min | Critical |
| Ingestion lag | Queue depth > 1000 for 10min | Warning |
| Credential mass expiry | >5 services expiring in 24h | Warning |
| KMS errors | Any KMS call failure | Critical |
| Plugin crash | Worker thread exception | Warning |

---

## 20. Security Considerations

### 20.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Credential theft (DB compromise) | Envelope encryption, KMS-managed keys, encrypted at rest |
| Credential theft (memory dump) | Credentials decrypted only in request scope, not cached |
| Man-in-the-middle | TLS 1.3, certificate pinning for API calls |
| Cross-tenant data leak | PostgreSQL RLS, tenant_id in every query, middleware enforcement |
| OAuth token replay | Tokens encrypted, short-lived access tokens, refresh rotation |
| Malicious plugin | Worker thread isolation, no DB access, capability declaration + approval |
| Rate limit abuse | Per-tenant token bucket, circuit breaker on external calls |
| Audit log tampering | Append-only table, no UPDATE/DELETE, pgAudit extension |
| Session hijacking | Secure cookie flags, short JWT expiry, Redis session blacklist |

### 20.2 Compliance Checklist

- [ ] GDPR: Data export endpoint (all content items as JSON)
- [ ] GDPR: Right to deletion (anonymize content, destroy vault keys)
- [ ] CCPA: Privacy policy, data collection disclosure
- [ ] SOC 2 Phase 2: Access reviews, audit logs, encryption verification
- [ ] OWASP Top 10: Input validation, parameterized queries, CSRF protection
- [ ] PCI DSS: Not applicable (no payment processing)

---

## 21. Architecture Decision Records (ADRs)

### ADR-001: Envelope Encryption over Application-Layer Encryption

**Status:** Proposed

**Context:** Credentials must be encrypted at rest. Options: (A) Encrypt in app using a hardcoded key, (B) Use envelope encryption with KMS, (C) Use OS keyring.

**Decision:** Use envelope encryption with AWS KMS. DEKs per credential, KEK managed by KMS. Provides key rotation without re-encrypting all data, audit trail via CloudTrail, and no key material in application memory.

**Consequences:** Requires AWS dependency. Self-hosted alternative: HashiCorp Vault Transit engine. Abstract behind `VaultService` interface.

### ADR-002: BullMQ over RabbitMQ/Kafka

**Status:** Proposed

**Context:** Need a job queue for ingestion workers and retry logic.

**Decision:** Use BullMQ (Redis-backed). Already using Redis for caching/pub-sub. Lower operational overhead than RabbitMQ. Sufficient for <100K jobs/day.

**Consequences:** Redis becomes critical path. If scaling beyond 100K jobs/day, revisit Kafka.

### ADR-003: Plugin Isolation via Worker Threads

**Status:** Proposed

**Context:** Third-party plugins need to execute code. Options: (A) In-process with sandbox, (B) Node.js worker_threads, (C) Docker containers per plugin.

**Decision:** Use `worker_threads` with `MessageChannel` for communication. Sufficient isolation for v1. No DB access, network limited to declared capabilities.

**Consequences:** If plugins need stronger isolation (e.g., full OS access), migrate to Docker containers in v2.

### ADR-004: Lightweight vs. Full Integration Tiering

**Status:** Proposed

**Context:** Some services (LinkedIn) have severely limited APIs. Others (WhatsApp personal) are TOS-violating to integrate.

**Decision:** Two tiers:
- **Full:** Bidirectional, webhooks, moderation actions, real-time sync
- **Lightweight:** Read-only polling, no writes, no webhooks, longer intervals

Each connector declares its tier in its manifest. UI adapts: lightweight nodes show grey icon, no write actions.

**Consequences:** Users get degraded experience on lightweight services. Can be upgraded if API capabilities expand.

### ADR-005: Next.js + NestJS Over a Monolith

**Status:** Proposed

**Context:** Could use Next.js API routes as a monolith. Separated backend offers: independent scaling, worker separation, plugin isolation.

**Decision:** Separate Next.js (frontend) and NestJS (API + workers). Communicate via REST + WebSocket.

**Consequences:** More deployment complexity, but better scalability and separation of concerns.

---

## 22. Roadmap

### Phase 0: Foundation (Weeks 1–4)

- [ ] Monorepo setup (Turborepo + pnpm)
- [ ] PostgreSQL + Redis + Docker Compose
- [ ] NestJS API skeleton with auth (NextAuth + JWT)
- [ ] Next.js frontend skeleton with tree view
- [ ] Encrypted credential vault (AWS KMS integration)
- [ ] CI/CD pipeline (GitHub Actions)

### Phase 1: Core Connectors (Weeks 5–10)

- [ ] YouTube connector (full)
- [ ] Meta/Facebook connector (full)
- [ ] X/Twitter connector (full)
- [ ] Ingestion pipeline (BullMQ workers)
- [ ] Moderation engine (approve/delete/flag)
- [ ] Real-time updates (WebSocket)

### Phase 2: Expanded Connectors (Weeks 11–16)

- [ ] WhatsApp Business connector (full)
- [ ] Reddit connector (full)
- [ ] Telegram Bot connector (full)
- [ ] Instagram connector (full)
- [ ] LinkedIn connector (lightweight)
- [ ] TikTok connector (full)
- [ ] Unified inbox view

### Phase 3: Plugin SDK (Weeks 17–20)

- [ ] `@media-basket/connector-sdk` published
- [ ] Plugin manifest validation
- [ ] Plugin loader (worker_threads)
- [ ] Plugin marketplace UI
- [ ] 1 community plugin example

### Phase 4: Enterprise & Polish (Weeks 21–26)

- [ ] Advanced analytics dashboard
- [ ] Bulk moderation workflows
- [ ] Audit log viewer
- [ ] Organization admin panel
- [ ] Rate limiting dashboard
- [ ] SOC 2 documentation
- [ ] Performance optimization (10K concurrent users)

### Phase 5: Scale & Ecosystem (Weeks 27+)

- [ ] Kubernetes Helm chart
- [ ] Self-hosted Docker image
- [ ] Plugin marketplace (public)
- [ ] API v2 with GraphQL option
- [ ] Mobile app (React Native)
- [ ] AI-assisted moderation (sentiment, spam detection)

---

## 23. Open Questions

| # | Question | Impact | Recommendation |
|---|----------|--------|----------------|
| 1 | **Credential storage for self-hosted:** Should we support HashiCorp Vault as KMS alternative? | Deployment flexibility | Yes, abstract behind `VaultService` interface |
| 2 | **Webhook security:** Should we require webhook signature verification for all connectors? | Security posture | Yes, mandate in SDK contract |
| 3 | **Content retention:** Default 90 days — too short or too long? | Storage cost vs. compliance | Configurable per org, 90-day default |
| 4 | **WhatsApp personal accounts:** Strictly TOS-violating — should we document the risk and allow it? | Legal exposure | No. Only WhatsApp Business Cloud API |
| 5 | **AI moderation:** Build in-house or integrate existing (Perspective API, OpenAI Moderation)? | Speed to market | Integrate Perspective API as optional add-on |
| 6 | **Offline mode:** Should the tree view work offline with cached data? | UX, complexity | Phase 5 consideration |
| 7 | **Multi-org per user:** Should a user belong to multiple organizations simultaneously? | User experience | Yes, org switcher in topbar |
| 8 | **Custom domains:** Should tenants get custom domains? | Enterprise appeal | Phase 4+ |

---

*End of ARCHITECTURE.md — Media_Basket v0.1.0*
*Awaiting review and refinement before implementation phase.*
