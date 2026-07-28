# Media_Basket — Agent Memory

> Auto-generated context file for AI sessions. Do not edit manually unless refining project context.

---

## Original Prompt

> "A web based full stack software program aims to collect all media accounts in one basket so the user can easily moderate and manage its related services.
> Style like windows explorer tree view structure that each node represents one media service .e.g. node for Facebook, one for WhatsApp, one for youtube and so on.
> the user has control on which media service to add in the basket to follow and interact with and add its credential on setting page of the bask.
> each media service may be fully integrated with the system or light weight pipeline channel to grep data from the specified provider.
> that the idea so make your best effort as a novel system architecture expert to build a smart plan for review and refine before implementation phase.
> is it clear to you."

**Status:** ✅ Understood. Architecture planned. ROADMAP.md v1 scoped. Ready for implementation.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | Media_Basket |
| **Type** | Web-based full-stack application |
| **Concept** | Windows Explorer tree view for managing multiple media accounts in one place |
| **Core Metaphor** | Basket — a workspace with tree nodes, each representing a media service |
| **Repo** | https://github.com/SowinySoft/Media-Basket |
| **Push Convention** | After each effort of work, push to repo |

---

## Active Documents

| Document | Role | Status |
|----------|------|--------|
| `ROADMAP.md` | **Active working plan** — all changes go here | ✅ Current |
| `ARCHITECTURE.md` | Full-system vision reference | ❄️ Frozen — do not modify |

---

## Tech Stack (v1)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router) + React 18 + TypeScript |
| Tree View | `react-arborist` |
| UI Kit | Tailwind CSS + Radix UI |
| Backend API | FastAPI (Python 3.12+) |
| Auth | NextAuth.js → FastAPI JWT bridge |
| ORM | SQLAlchemy 2.0 (async) + Alembic |
| Database | PostgreSQL 16 |
| Queue | Celery 5 + Redis broker + Beat scheduler |
| Cache | Redis 7 |
| ML Pipeline | scikit-learn + spaCy + HuggingFace + ONNX Runtime |
| Secrets | HashiCorp Vault (dev mode for local) |
| Storage | MinIO (local S3-compatible) |
| Logging | Python `structlog` |
| Monitoring | OpenTelemetry + Prometheus + Grafana |
| Container | Docker + Docker Compose |

---

## Scope (v1 — SaaS-Ready)

| Dimension | Decision |
|-----------|----------|
| **Connectors** | 3 only: YouTube, Reddit, WhatsApp Business |
| **View** | Tree view only (no tab view) |
| **Deployment** | Self-hosted Docker |
| **Multi-tenant** | SaaS-ready from day one — org model, RLS, RBAC all built in |
| **RBAC** | Owner / Admin / Member / Viewer — enforced |
| **Billing** | Endpoints exist (placeholder) — no Stripe yet |
| **Plugin SDK** | No — v3 |
| **ML** | Yes — sentiment, spam, toxicity, auto-tagging |
| **SaaS** | Ready — flip a switch, add users, it's multi-tenant |

---

## ML Pipeline (v1)

| Model | Purpose | Ships In v1 |
|-------|---------|-------------|
| VADER / DistilBERT | Sentiment analysis | ✅ |
| TF-IDF + Logistic Regression | Spam detection | ✅ |
| Toxic-BERT | Toxicity detection | Optional (GPU) |
| spaCy NER | Auto-tagging | ✅ |
| fasttext | Language detection | ✅ |

---

## Connectors

| Service | Tier | Auth | Poll | Webhooks | Writes |
|---------|------|------|------|----------|--------|
| YouTube | Full | OAuth 2.0 | 5m (Celery Beat) | ❌ | Comment moderation |
| Reddit | Full | OAuth 2.0 | 5m (Celery Beat) | ❌ | Approve/remove/comment |
| WhatsApp Business | Full | OAuth 2.0 (Meta) | ❌ (webhook-driven) | ✅ | Send messages/replies |

---

## Timeline

```
Week 1-3:  SaaS Foundation  → Org, User, Member, RBAC, RLS, Vault, Auth, Billing, Audit
Week 4-5:  YouTube          → Connector, Celery, moderation, Vault namespace
Week 5-7:  Reddit           → Connector, pattern validated, cross-org isolation
Week 7-8:  WhatsApp         → Connector, webhooks, HMAC verification
Week 8-9:  ML Pipeline      → Sentiment, spam, toxicity, org-scoped
Week 9-10: Polish           → Dashboard, search, dark mode, docs, ship
```

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Tree view only (no tabs) | Novel differentiator, keep focus |
| Python/FastAPI over Node/NestJS | ML pipeline natural fit, SQLAlchemy maturity |
| Celery over BullMQ | Python ecosystem, beat scheduler for periodic sync |
| 3 connectors not 9 | Ship fast, validate, expand later |
| Self-hosted Docker first | Zero credential liability, no SOC 2 needed |
| ML from day one | Smart moderation is a differentiator |
| HashiCorp Vault over app-level key | Future-proof for SaaS, Transit engine, easy upgrade path |
| SaaS-ready from day one | All infrastructure (org, RBAC, RLS, billing) built in — flip a switch for multi-tenant |

---

## Enhancements (v1)

| Enhancement | Purpose |
|-------------|---------|
| Health check dashboard | One screen showing all service status, ML health, Vault status |
| Tree search (Ctrl+F) | Find nodes quickly when tree grows |
| Retry + Dead Letter Queue | Visibility into failed Celery tasks |
| Webhook signature verification | Prevent spoofed WhatsApp messages |
| Export data (GDPR) | Users own their data from day one |
| Backup/restore scripts | One-command disaster recovery |
| Rate limit dashboard | Show API quota consumption per service |
| Dark mode | Low effort, high satisfaction |

---

## Completeness

| ARCHITECTURE.md Section | In ROADMAP? | Notes |
|------------------------|-------------|-------|
| Vision & Overview | ✅ | Reframed for SaaS-ready self-hosted |
| Personas & Use Cases | ✅ | Implicit in features |
| Functional Requirements | ✅ | All covered |
| Non-Functional Requirements | ✅ | Full table with v1/v2 targets, GDPR, SOC 2 |
| Tech Stack | ✅ | Python/FastAPI (different from ARCHITECTURE's NestJS) |
| System Architecture Diagrams | ✅ | Updated for FastAPI/Celery |
| Component Breakdown | ✅ | All covered |
| Data Model | ✅ | Expanded with org_id, RBAC, billing, audit |
| Auth & RBAC | ✅ | Full Owner/Admin/Member/Viewer |
| Credential Vault | ✅ | HashiCorp Vault, org namespaces |
| Connector SDK | ✅ | Contract defined, 3 built-in connectors implement it, v3 adds dynamic loading |
| 9 Connector Profiles | ⚠️ 3 of 9 | YouTube, Reddit, WhatsApp (all implement ConnectorPlugin ABC — v2 adds rest with zero effort) |
| Ingestion Pipeline | ✅ | Celery-based |
| Eventing & Real-Time | ✅ | WebSocket, org-filtered |
| Frontend Architecture | ✅ | Next.js, tree view |
| API Surface | ✅ | All endpoints covered |
| Database Schema | ✅ | Full SQLAlchemy models |
| Deployment | ✅ | Docker Compose (v2 adds K8s) |
| Observability | ✅ | OpenTelemetry + Prometheus |
| Security | ✅ | RLS, HMAC, audit log |
| ADRs | ✅ | 7 decision records |
| Open Questions | ✅ | 10 resolved questions |
| 3rd-Party Plugins | ✅ | Contract defined, v3 placeholder |

---

## What v1 Is NOT (Yet)

- ❌ Not 9 connectors (only 3)
- ❌ Not a plugin SDK (contract defined, v3 implementation)
- ❌ Not SOC 2 compliant (placeholder in NFR)
- ❌ Not horizontally scaled (single Docker Compose)
- ❌ No Stripe billing (endpoints exist, no payment)
- ❌ No email delivery (no SMTP)
- ❌ No hosted deployment (self-hosted only)

---

## Future Expansion (post-v1)

```
v2.0: Stripe billing — wire endpoints, Free/Pro/Enterprise tiers
v2.1: Invite flow — email invitations, org member onboarding
v2.2: Org switcher UI — users belong to multiple orgs
v2.3: Kubernetes deployment — Helm chart, horizontal scaling
v2.4: Meta/Facebook connector (implement ConnectorPlugin ABC)
v2.5: X/Twitter connector (implement ConnectorPlugin ABC)
v2.6: Telegram Bot connector (implement ConnectorPlugin ABC)
v2.7: Instagram connector (implement ConnectorPlugin ABC)
v2.8: LinkedIn connector (implement ConnectorPlugin ABC)
v2.9: TikTok connector (implement ConnectorPlugin ABC)
v3.0: Plugin SDK — community connectors
v3.1: Advanced analytics, bulk moderation
v3.2: GPU ML, fine-tuned models
v4.0: Full platform with marketplace
```

---

*Last updated: 2026-07-28*
*Focus: ROADMAP.md v1 (SaaS-Ready, Self-Hosted)*
