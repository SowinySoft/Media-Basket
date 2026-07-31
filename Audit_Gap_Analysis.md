# ARCHITECTURE.md — Audit Gap Analysis

> **Date:** 2026-07-31
> **Comparing:** ARCHITECTURE.md v0.1.0 vs. Actual Codebase (post Phase A-D)

---

## Critical Gaps (6)

| # | Gap | ARCHITECTURE Spec | Current State |
|---|-----|-------------------|---------------|
| 1 | **Vault stores plaintext JSON** | Encrypted DB columns (encrypted_blob, iv, tag, dek_ciphertext) + KMS envelope encryption | `vault_path` string → `secrets.json` file on disk |
| 2 | **No KMS integration** | AWS KMS or Vault Transit for zero-knowledge encryption | KEK derived from `JWT_SECRET_KEY` locally, no external KMS |
| 3 | **CredentialVault missing encryption columns** | `encrypted_blob`, `iv`, `tag`, `dek_ciphertext` bytea columns | Only `vault_path` (String), `key_version` (Integer) |
| 4 | **No `service_permissions` on Member** | FR-12: per-service access control per member via `service_permissions` JSONB | Member model has no `service_permissions` field |
| 5 | **Plugin loader no sandbox** | FR-15: worker_threads isolation, no DB access, network limited to capabilities | `importlib` loads plugins in-process with full DB access |
| 6 | **No session blacklisting** | Redis session blacklist for revoked tokens, JWT revocation | JWTs in localStorage, no server-side revocation |

---

## Important Gaps (18)

| # | Gap | Impact |
|---|-----|--------|
| 7 | Vault audit logging exists but never called | No audit trail produced |
| 8 | Inbox shows content items, not notifications | FR-06 not met |
| 9 | Only 3/13 WebSocket event types implemented | Missing: service.connected, content.new, credential.expired, etc. |
| 10 | No Redis pub/sub for WebSocket fan-out | Won't work across multiple API instances |
| 11 | Content pipeline only has 2/8 stages | Missing: trigger, fetch, dedup, emit, alert |
| 12 | No per-connector Redis rate limit tracking | External API quotas not respected |
| 13 | Root page is landing page, not dashboard | No aggregated dashboard view |
| 14 | 3/8 Prometheus metrics missing | credential_expiry, plugin_load, rate_limit_remaining |
| 15 | structlog configured but only used in 2 files | No structured logging in 40+ route modules |
| 16 | No alerting rules configuration | No Prometheus/Grafana alerting |
| 17 | No CSRF protection | OWASP Top 10 compliance gap |
| 18 | JWT in localStorage (XSS-vulnerable) | Should use secure httpOnly cookies |
| 19 | Audit logs not append-only (no pgAudit) | Logs can be modified/deleted |
| 20 | No data retention policy | Content accumulates indefinitely |
| 21 | Backups are manual only | No automated daily backups |
| 22 | No TypeScript Connector SDK | Third-party developers can't write plugins |
| 23 | No inbound webhook pattern (only WhatsApp) | Generic webhook endpoint not implemented |
| 24 | Tenant context not set on every request | RLS may not be enforced |

---

## Nice-to-have Gaps (6)

| # | Gap |
|---|-----|
| 25 | No admin page |
| 26 | No tree context menus (right-click) |
| 27 | No TreeNodeBadge notification counts |
| 28 | No plugin manifest JSON validation |
| 29 | No CONNECTOR_TYPE model in DB |
| 30 | backup.sh shebang after comment line |

---

## Tech Stack Deviation (Acknowledged)

| ARCHITECTURE | Actual | Status |
|-------------|--------|--------|
| NestJS (TypeScript) | FastAPI (Python) | Functional — different ecosystem |
| Drizzle ORM | SQLAlchemy 2.0 async | Functional — Python-native |
| BullMQ (Redis) | Celery (Redis) | Functional — different queue |
| Pino logging | structlog | Configured, barely wired |
| NextAuth.js | Custom JWT | Simpler, functional |
| AWS KMS | Local file encryption | **Security gap** |
| worker_threads sandbox | importlib in-process | **Isolation gap** |

---

## Recommended Fix Order

### Phase E — Critical Fixes (this sprint)
1. Move vault storage to DB columns with envelope encryption
2. Add `service_permissions` to Member model
3. Add Redis session blacklisting
4. Wire vault audit logging into vault operations

### Phase F — Important Fixes (next sprint)
5. Add missing WebSocket event types
6. Wire structlog into all routes
7. Add missing Prometheus metrics
8. CSRF protection + secure cookie JWT
9. Data retention policy + automated backups

### Phase G — Nice-to-have (backlog)
10. Admin page, tree context menus, badges
11. Plugin manifest validation
12. TypeScript Connector SDK
