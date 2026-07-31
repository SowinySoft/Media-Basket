# MediaBasket — Realistic Next Pathway

> **Date:** 2026-07-31
> **Status:** v1 Complete (30/30 audit gaps resolved)
> **Author:** MediaBasket Team

---

## Where We Are

| Metric | Status |
|--------|--------|
| Backend | FastAPI + SQLAlchemy async + PostgreSQL + 8 Alembic migrations |
| Frontend | Next.js 14 + react-arborist + Zustand + Tailwind (dark theme) |
| Connectors | 15 (YouTube, Reddit, WhatsApp, Telegram, Instagram, Twitter, Facebook, LinkedIn, TikTok, Discord, Slack, Mastodon, Pinterest, Snapchat, Bluesky) |
| Security | Envelope encryption (AES-256-GCM), JWT httpOnly cookies, CSRF, RLS, pgAudit |
| ML Pipeline | 8-stage content pipeline with dedup, sentiment, spam, auto-tagging |
| Plugin System | ConnectorPlugin ABC, TypeScript SDK, manifest validation, DB-backed ConnectorType |
| SaaS | Org model, RBAC, RLS, billing endpoints, rate limiting, data retention, backups |
| Audit | 30/30 gaps resolved and wired |

**What's missing:** The app has never been run end-to-end against a real database. All code is written but untested in a live environment.

---

## Phase H: Get It Running (Week 1)

**Goal:** `docker compose up` → signup → add YouTube → sync → moderate. End-to-end validated.

### H1: Docker Compose Packaging

| Task | Detail |
|------|--------|
| `Dockerfile.backend` | Multi-stage: Python 3.12-slim, install deps, run uvicorn |
| `Dockerfile.frontend` | Multi-stage: Node 20, build Next.js, serve with nginx |
| `docker-compose.yml` | PostgreSQL 16, backend, frontend, Redis (optional) |
| `.env.example` | All env vars documented with defaults |
| Health checks | Backend `/api/v1/health`, frontend `/` |

### H2: Database Bootstrap

| Task | Detail |
|------|--------|
| `scripts/init_db.sh` | Run Alembic migrations 001–008 on first boot |
| Seed data | Default billing plan, connector types (already in 008) |
| RLS activation | Verify `app.current_tenant` is set on every session |

### H3: End-to-End Test

| Task | Detail |
|------|--------|
| Signup flow | Create user → auto-create org → tree view loads |
| YouTube connect | OAuth → credentials stored encrypted → sync runs |
| Content in tree | Videos appear under YouTube node with sentiment badges |
| Moderation | Right-click → approve/flag from tree context menu |
| Notifications | Inbox shows new content notifications |
| WebSocket | Real-time updates appear without page refresh |

### H4: First Real YouTube Sync

| Task | Detail |
|------|--------|
| OAuth app | Verify Google Cloud Console credentials work |
| Channel fetch | Pull channel info from sowinysoft |
| Video sync | Fetch public videos, store in DB with metadata |
| Comment sync | Pull comments, run sentiment analysis |
| Verify encryption | Check `credential_vault` has encrypted data, not plaintext |

---

## Phase I: Production Hardening (Weeks 2-3)

**Goal:** Deployable, observable, secure for real usage.

### I1: Error Handling & Resilience

| Task | Detail |
|------|--------|
| Global exception handler | Catch unhandled errors, return structured JSON |
| Token refresh | Auto-refresh expired YouTube/Reddit tokens |
| Sync retry | Failed syncs retry with exponential backoff |
| DLQ viewer | Dead letter queue UI for failed tasks |
| Graceful degradation | If ML is down, content still syncs (without sentiment) |

### I2: Observability

| Task | Detail |
|------|--------|
| Request IDs | Correlation ID on every request for tracing |
| Structured logging | Wire structlog into ALL route files (currently 4/50+) |
| Grafana dashboards | Pre-built dashboards for Prometheus metrics |
| Alerting rules | Grafana alerts for: high error rate, low disk, sync failures |
| Uptime monitoring | Health check endpoint with dependency status |

### I3: Security Hardening

| Task | Detail |
|------|--------|
| HTTPS | Let's Encrypt or self-signed cert for local |
| CSP headers | Content-Security-Policy for XSS prevention |
| Rate limit tuning | Per-connector limits based on platform quotas |
| Input validation | Pydantic models for all query params and path params |
| CORS lockdown | Restrict to actual frontend domain |

### I4: Data Integrity

| Task | Detail |
|------|--------|
| RLS verification | Automated test: User A cannot see User B's data |
| Audit trail test | Verify every mutation produces an audit_log entry |
| Backup test | Run backup.sh + restore.sh, verify data integrity |
| Content dedup test | Same YouTube video synced twice → only one DB row |

---

## Phase J: Connector Completion (Weeks 4-6)

**Goal:** All 15 connectors fully functional (not just skeleton code).

### J1: Priority Connectors (OAuth works, sync works)

| Connector | OAuth | Sync | Moderate | Status |
|-----------|-------|------|----------|--------|
| YouTube | ✅ | ✅ | ✅ | Working |
| Reddit | ✅ | ⚠️ | ⚠️ | Needs API approval |
| WhatsApp | ✅ | ⚠️ | ⚠️ | Webhook only, needs production URL |
| Telegram | ⚠️ | ⚠️ | ⚠️ | Bot token, needs testing |
| Instagram | ⚠️ | ⚠️ | ❌ | Graph API review required |
| Facebook | ⚠️ | ⚠️ | ⚠️ | Graph API review required |
| Twitter | ⚠️ | ⚠️ | ⚠️ | API v2, needs elevated access |
| Discord | ⚠️ | ⚠️ | ⚠️ | Bot token, needs testing |
| Slack | ⚠️ | ⚠️ | ⚠️ | OAuth + bot, needs testing |
| LinkedIn | ⚠️ | ⚠️ | ❌ | Limited API, no moderation |
| TikTok | ⚠️ | ⚠️ | ❌ | Limited API, no moderation |
| Mastodon | ⚠️ | ⚠️ | ⚠️ | OAuth, needs instance selection |
| Pinterest | ⚠️ | ⚠️ | ❌ | Limited API |
| Snapchat | ⚠️ | ❌ | ❌ | Very limited API |
| Bluesky | ⚠️ | ⚠️ | ⚠️ | App password auth |

**Legend:** ✅ Working, ⚠️ Partial/skeleton, ❌ Not implemented

### J2: Connector Testing Matrix

For each connector:
1. Create OAuth app / get API credentials
2. Test authentication flow end-to-end
3. Test sync (fetch content, store in DB)
4. Test moderation (where supported)
5. Test webhook (where supported)
6. Verify rate limiting per platform quotas
7. Add to integration test suite

### J3: Connector-Specific Features

| Feature | Connectors | Detail |
|---------|-----------|--------|
| Webhook receiver | YouTube, WhatsApp, Discord, Slack, Facebook, Mastodon | HMAC-SHA256 verified |
| Media handling | YouTube, Instagram, TikTok, Pinterest, Snapchat | Download + store in MinIO/S3 |
| Analytics | YouTube, Instagram, Facebook, LinkedIn, TikTok | Engagement metrics |
| Real-time | Discord, Slack, Telegram | WebSocket connections |

---

## Phase K: Frontend Polish (Weeks 7-8)

**Goal:** Professional, polished UI that feels like a real product.

### K1: Dashboard

| Task | Detail |
|------|--------|
| Widget renderer | Actually render DashboardBuilder widgets with real data |
| Analytics summary | Total content, sentiment breakdown, top services |
| Recent activity | Feed of recent syncs, moderations, alerts |
| Service health | Connection status for each service |
| Quick actions | Common tasks accessible from dashboard |

### K2: Content Detail Panel

| Task | Detail |
|------|--------|
| Rich content view | Render YouTube videos, Instagram posts, tweets properly |
| Thread view | Show comment threads with parent/child relationships |
| Media viewer | Inline image/video player |
| Moderation controls | Approve, flag, delete, reply buttons |
| Metadata display | Sentiment, spam score, language, auto-tags |

### K3: Settings Pages

| Task | Detail |
|------|--------|
| Org settings | Name, slug, plan, billing |
| Service management | List connected services, disconnect, re-sync |
| Credential vault | View encrypted credentials (decrypted on demand) |
| Member management | Invite, remove, change roles |
| Plugin catalog | Install, activate, deactivate plugins |
| Alerting rules | Create/edit/delete alert thresholds |
| Data retention | Configure cleanup thresholds |
| Backup | Manual backup trigger, download backup file |

### K4: Mobile Experience

| Task | Detail |
|------|--------|
| Responsive tree | Touch-friendly expand/collapse |
| Swipe actions | Swipe to moderate on mobile |
| Bottom navigation | Mobile nav bar with key actions |
| Offline indicator | Show connection status |

---

## Phase L: SaaS Launch (Months 3-4)

**Goal:** Ready for paying customers.

### L1: Stripe Integration

| Task | Detail |
|------|--------|
| Stripe checkout | Free → Pro → Enterprise upgrade flow |
| Webhook handler | Handle `checkout.session.completed`, `invoice.paid` |
| Usage metering | Track API calls, content items, ML analyses per billing period |
| Plan limits | Enforce max_services, max_members, max_ml per plan |
| Billing portal | Self-serve: view invoices, update payment, cancel |

### L2: Invite Flow

| Task | Detail |
|------|--------|
| Email service | SMTP or SendGrid for invite emails |
| Invite tokens | Unique invite links with expiry |
| Accept invite | Signup flow with pre-filled org |
| Role assignment | Inviter chooses role (admin/member/viewer) |

### L3: Multi-Org

| Task | Detail |
|------|--------|
| Org switcher | Topbar dropdown to switch between orgs |
| Personal org | Every user gets a personal org on signup |
| Cross-org | Users can belong to multiple orgs simultaneously |

### L4: Deployment

| Task | Detail |
|------|--------|
| Kubernetes Helm chart | Production-grade deployment |
| Auto-scaling | HPA based on CPU/request count |
| Managed PostgreSQL | AWS RDS / GCP Cloud SQL |
| Managed Redis | AWS ElastiCache / GCP Memorystore |
| CDN | CloudFront for frontend static assets |

---

## Phase M: Plugin Marketplace (Months 5-6)

**Goal:** Third-party developers can build and publish connectors.

### M1: Plugin Sandbox

| Task | Detail |
|------|--------|
| RestrictedPython | Sandboxed execution for untrusted code |
| Network isolation | Allowlist outbound connections per plugin |
| DB access blocked | Plugins cannot access the database directly |
| Resource limits | CPU, memory, execution time limits per plugin |

### M2: Marketplace UI

| Task | Detail |
|------|--------|
| Browse plugins | Search, filter by tier, category |
| Plugin details | Description, capabilities, reviews, install count |
| Install flow | One-click install with configuration |
| Plugin updates | Auto-check for updates, changelog |

### M3: Developer SDK

| Task | Detail |
|------|--------|
| Python SDK | `pip install mediabasket-connector` |
| TypeScript SDK | Already exists, needs npm publish |
| CLI tool | `mediabasket plugin create`, `mediabasket plugin test` |
| Documentation | Developer guide, API reference, examples |
| Submit process | PR-based review for marketplace listing |

---

## Timeline Summary

```
Week 1:       Phase H — Get It Running
Weeks 2-3:    Phase I — Production Hardening
Weeks 4-6:    Phase J — Connector Completion (15 connectors)
Weeks 7-8:    Phase K — Frontend Polish
Months 3-4:   Phase L — SaaS Launch (Stripe, invites, multi-org)
Months 5-6:   Phase M — Plugin Marketplace
```

---

## Success Criteria

| Milestone | Target | How to Verify |
|-----------|--------|---------------|
| Docker up | `docker compose up` works on fresh machine | Clean install test |
| First sync | YouTube channel syncs successfully | Videos appear in tree |
| Moderation works | Approve/flag from tree context menu | DB state changes |
| Real-time | WebSocket delivers updates | Open two browsers, sync in one |
| RLS enforced | User A cannot see User B's data | Automated test |
| Backup works | backup.sh + restore.sh roundtrip | Data integrity check |
| Stripe works | Upgrade from Free to Pro | Payment + plan change |
| Plugin loads | 3rd-party connector installs and runs | Sandbox verification |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube API quota exhaustion | Cannot sync | Cache aggressively, respect quotas |
| Reddit API approval denied | Cannot test Reddit connector | Use read-only mode, request minimal scopes |
| PostgreSQL RLS misconfiguration | Data leak | Automated RLS test in CI |
| Plugin executes malicious code | System compromise | Sandboxing (RestrictedPython/Docker) |
| Stripe webhook failure | Billing mismatch | Idempotent handlers, reconciliation job |
| WebSocket memory leak | Server crash | Connection limits, heartbeat cleanup |

---

*Next step: Start Phase H — Docker Compose packaging + first real YouTube sync.*
