# Media Basket — Railway Deployment Settings

> Save this file for reference when deploying to a new Railway account.
> Generated: 2026-08-01

---

## Project Structure

```
Railway Project: Media-Basket
├── Postgres          (PostgreSQL 18, managed)
├── Redis             (Redis 8.2, managed)
└── Media-Basket      (FastAPI backend, root dir: backend/)
```

**Frontend** is deployed separately on Vercel (see `MediaBasket_Vercel.md`).

---

## Service: Postgres

### Settings

| Setting | Value |
|---------|-------|
| Image | `ghcr.io/railwayapp-templates/postgres-ssl:18` |
| Volume Mount | `/var/lib/postgresql/data` |
| Volume Size | 500 MB |
| Region | US East |

### Environment Variables (auto-provisioned)

| Variable | Value |
|----------|-------|
| `POSTGRES_DB` | `railway` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `HhUMHYvHlclslomrqcYozpdkoVlECJxS` |
| `PGDATABASE` | `railway` |
| `PGHOST` | `postgres.railway.internal` |
| `PGPORT` | `5432` |
| `PGUSER` | `postgres` |
| `PGPASSWORD` | `HhUMHYvHlclslomrqcYozpdkoVlECJxS` |
| `DATABASE_URL` | `postgresql://postgres:HhUMHYvHlclslomrqcYozpdkoVlECJxS@postgres.railway.internal:5432/railway` |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` |

### Connection (internal)

```
Host: postgres.railway.internal
Port: 5432
Database: railway
User: postgres
Password: HhUMHYvHlclslomrqcYozpdkoVlECJxS
```

### Connection (external — for local dev)

```
Host: postgres.railway.internal
Port: 5432
Database: railway
User: postgres
Password: HhUMHYvHlclslomrqcYozpdkoVlECJxS
```

> ⚠️ The public URL has a redacted host. Use Railway's **Connect** button for external access, or connect via the private network.

---

## Service: Redis

### Settings

| Setting | Value |
|---------|-------|
| Image | `redis:8.2.1` |
| Volume Mount | `/data` |
| Volume Size | 500 MB |
| Region | US East |

### Environment Variables (auto-provisioned)

| Variable | Value |
|----------|-------|
| `REDISHOST` | `redis.railway.internal` |
| `REDISPORT` | `6379` |
| `REDISUSER` | `default` |
| `REDIS_PASSWORD` | `lzrSOqScVvMDlfbMRnVwumdPGNPyFdRj` |
| `REDIS_URL` | `redis://default:lzrSOqScVvMDlfbMRnVwumdPGNPyFdRj@redis.railway.internal:6379` |

### Connection (internal)

```
Host: redis.railway.internal
Port: 6379
User: default
Password: lzrSOqScVvMDlfbMRnVwumdPGNPyFdRj
```

---

## Service: Media-Basket (Backend)

### Settings

| Setting | Value |
|---------|-------|
| Source | `SowinySoft/Media-Basket` (GitHub) |
| Branch | `main` |
| Root Directory | `backend` |
| Builder | Railpack |
| Region | US East |
| Replicas | 1 |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-graceful-shutdown 30` |
| Healthcheck Path | `/api/v1/health` |
| Healthcheck Timeout | (default) |
| Restart Policy | `ON_FAILURE` (max 10 retries) |
| Runtime | V2 |

### Build Settings

| Setting | Value |
|---------|-------|
| Build Environment | V3 |
| Builder | RAILPACK |
| Dockerfile | (none — auto-detected from `backend/`) |

### Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_NAME` | `Media Basket` | App display name |
| `APP_VERSION` | `0.1.0` | Semver version |
| `DEBUG` | `false` | Disable Swagger/ReDoc in production |
| `DATABASE_URL` | `postgresql://postgres:HhUMHYvHlclslomrqcYozpdkoVlECJxS@postgres.railway.internal:5432/railway` | Async connection (asyncpg) |
| `DATABASE_URL_SYNC` | `postgresql://postgres:HhUMHYvHlclslomrqcYozpdkoVlECJxS@postgres.railway.internal:5432/railway` | Sync connection (Alembic migrations) |
| `REDIS_URL` | `redis://default:lzrSOqScVvMDlfbMRnVwumdPGNPyFdRj@redis.railway.internal:6379` | Celery broker + cache |
| `JWT_SECRET_KEY` | `aaWZl1Ceb2AHFtPXvvlkF03ZY5a8x3t9qaxG_is8kg3Zt0M8dKlobO6OmWItoEHG` | ⚠️ Generate new for each deployment |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token TTL |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token TTL |
| `CORS_ORIGINS` | `["https://media-basket-web.up.railway.app","https://media-basket-api.up.railway.app"]` | Update with actual frontend domain |
| `WHATSAPP_VERIFY_TOKEN` | `media-basket-verify` | WhatsApp webhook verification |
| `YOUTUBE_REDIRECT_URI` | `http://localhost:8000/api/v1/services/callback/youtube` | ⚠️ Update for production |
| `REDDIT_REDIRECT_URI` | `http://localhost:8000/api/v1/services/callback/reddit` | ⚠️ Update for production |

### Internal URLs

| Service | URL |
|---------|-----|
| Postgres | `postgresql://postgres:HhUMHYvHlclslomrqcYozpdkoVlECJxS@postgres.railway.internal:5432/railway` |
| Redis | `redis://default:lzrSOqScVvMDlfbMRnVwumdPGNPyFdRj@redis.railway.internal:6379` |
| Self | `media-basket.railway.internal` |

### Public URLs (after domain added)

| Type | URL |
|------|-----|
| Backend API | `https://media-basket-api.up.railway.app` |

---

## Deployment Steps (New Railway Account)

### Prerequisites

- Railway CLI installed: `npm i -g @railway/cli`
- GitHub repo: `SowinySoft/Media-Basket`
- Logged in: `railway login`

### Step 1: Create Project

```bash
railway init --name Media-Basket
```

### Step 2: Add Postgres

```bash
railway add --database postgres
```

### Step 3: Add Redis

```bash
railway add --database redis
```

### Step 4: Add Backend Service

```bash
railway add --service Media-Basket
railway service source connect --repo SowinySoft/Media-Basket --branch main --service Media-Basket
```

### Step 5: Configure Backend Service

```bash
railway service config --service Media-Basket
```

Set in Railway Dashboard or via CLI:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-graceful-shutdown 30` |
| Healthcheck Path | `/api/v1/health` |

### Step 6: Set Backend Environment Variables

```bash
railway variable set \
  APP_NAME="Media Basket" \
  APP_VERSION="0.1.0" \
  DEBUG="false" \
  DATABASE_URL="postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway" \
  DATABASE_URL_SYNC="postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway" \
  REDIS_URL="redis://default:PASSWORD@redis.railway.internal:6379" \
  JWT_SECRET_KEY="$(node -e 'console.log(require('crypto').randomBytes(48).toString('base64url'))')" \
  JWT_ALGORITHM="HS256" \
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES="60" \
  JWT_REFRESH_TOKEN_EXPIRE_DAYS="30" \
  CORS_ORIGINS='["https://YOUR-FRONTEND.vercel.app"]' \
  --service Media-Basket
```

> Replace `PASSWORD` with actual Postgres/Redis passwords from the auto-provisioned services.

### Step 7: Run Migrations

After first deploy, run Alembic migrations:

```bash
railway run --service Media-Basket alembic upgrade head
```

Or SSH into the service:

```bash
railway ssh --service Media-Basket
alembic upgrade head
```

### Step 8: Add Public Domain

```bash
railway domain --service Media-Basket
```

### Step 9: Deploy

```bash
railway up --service Media-Basket
```

---

## Connector OAuth Redirect URIs

Update these after getting the public backend URL:

| Service | Redirect URI |
|---------|-------------|
| YouTube | `https://media-basket-api.up.railway.app/api/v1/services/callback/youtube` |
| Reddit | `https://media-basket-api.up.railway.app/api/v1/services/callback/reddit` |
| WhatsApp | Webhook: `https://media-basket-api.up.railway.app/api/v1/orgs/{org_id}/services/webhook/whatsapp` |

Update in Railway:
```bash
railway variable set \
  YOUTUBE_REDIRECT_URI="https://media-basket-api.up.railway.app/api/v1/services/callback/youtube" \
  REDDIT_REDIRECT_URI="https://media-basket-api.up.railway.app/api/v1/services/callback/reddit" \
  --service Media-Basket
```

---

## Resource Limits (Free Plan)

| Resource | Free Tier |
|----------|-----------|
| Services | 3 (Postgres, Redis, Backend) |
| RAM | 512 MB per service |
| CPU | 1 vCPU per service |
| Volume | 500 MB per volume |
| Egress | Limited |
| Domains | 1 per service |

> **Frontend cannot be added** on the free plan (limit: 3 services). Deploy to Vercel instead.

---

## Monitoring

| Endpoint | URL |
|----------|-----|
| Health check | `GET /api/v1/health` |
| Prometheus metrics | `GET /metrics` |
| Swagger docs | `GET /docs` (only when `DEBUG=true`) |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails with "Railpack could not determine how to build" | Ensure `rootDirectory` is set to `backend` |
| `databases not found` | Run `railway run alembic upgrade head` |
| CORS errors from frontend | Update `CORS_ORIGINS` with actual Vercel domain |
| `502 Bad Gateway` | Check healthcheck path is `/api/v1/health` |
| JWT auth fails | Ensure `JWT_SECRET_KEY` is set (not dev default) |
| Redis connection refused | Check `REDIS_URL` uses `redis.railway.internal` |
