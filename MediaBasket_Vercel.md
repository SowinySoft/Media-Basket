# Media Basket — Vercel Deployment Settings

> Save this file for reference when deploying to a new Vercel account.
> Generated: 2026-08-01

---

## Project Overview

| Field | Value |
|-------|-------|
| **Project Name** | `frontend` |
| **Project ID** | `prj_Z2eNC3oESRCTaAd3dNKpsHKK9IRV` |
| **Vercel Account** | `sowiny-soft-s-projects` |
| **Framework** | Next.js 14 (App Router) |
| **Root Directory** | `frontend/` |
| **Production URL** | https://frontend-tau-dusky-50.vercel.app |
| **Node Version** | 24.x (Vercel default) |

---

## Environment Variables

| Variable | Value | Environments |
|----------|-------|--------------|
| `NEXT_PUBLIC_API_URL` | `https://media-basket-production.up.railway.app` | Production |

> ⚠️ `NEXT_PUBLIC_*` variables are exposed to the browser. Do not put secrets here.

---

## Build Configuration

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `npm run build` (auto-detected) |
| Output Directory | `.next` (auto-detected) |
| Install Command | `npm ci` (auto-detected) |
| Development Command | `npm run dev` (auto-detected) |

---

## Deployed Pages

| Page | Route | Type |
|------|-------|------|
| Home | `/` | Static |
| Login | `/login` | Static |
| Tree View | `/tree` | Static |
| Dashboard | `/dashboard` | Static |
| Inbox | `/inbox` | Static |
| Settings | `/settings` | Static |
| Settings - Services | `/settings/services` | Static |
| Settings - Credentials | `/settings/credentials` | Static |
| Settings - Members | `/settings/members` | Static |
| Settings - Billing | `/settings/billing` | Static |
| Settings - Alerting | `/settings/alerting` | Static |
| Settings - Retention | `/settings/retention` | Static |
| Settings - Backup | `/settings/backup` | Static |
| Settings - Plugins | `/settings/plugins` | Static |
| Admin | `/admin` | Static |
| Marketplace | `/marketplace` | Static |
| Privacy | `/privacy` | Static |
| Workflows | `/workflows` | Static |
| Service Analytics | `/service/[id]/analytics` | Dynamic (SSR) |
| Service Content | `/service/[id]/content` | Dynamic (SSR) |
| Service Moderate | `/service/[id]/moderate` | Dynamic (SSR) |

---

## Deployment Steps (New Vercel Account)

### Prerequisites

- Vercel CLI installed: `npm i -g vercel`
- Logged in: `vercel login`
- Frontend source in `frontend/` directory

### Step 1: Login to Vercel

```bash
vercel login
```

This opens a browser for OAuth authentication. Complete the login.

### Step 2: Initialize Project

```bash
cd frontend
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (for new deployment)
- Project name? **frontend**
- Directory where code is located? **./**
- Override settings? **N** (auto-detected)

### Step 3: Set Environment Variables

```bash
vercel env add NEXT_PUBLIC_API_URL production
```

Enter value: `https://media-basket-production.up.railway.app`

### Step 4: Deploy to Production

```bash
vercel --prod
```

### Step 5: Verify

Open https://frontend-tau-dusky-50.vercel.app in your browser.

---

## Custom Domain (Optional)

To add a custom domain:

```bash
vercel domains add your-domain.com
```

Then configure DNS:
- Add a CNAME record pointing to `cname.vercel-dns.com`
- Or add A records pointing to Vercel's IPs

---

## Git Integration (Recommended)

Connect to GitHub for automatic deployments:

1. Go to https://vercel.com/new
2. Import the `SowinySoft/Media-Basket` repository
3. Set **Root Directory** to `frontend`
4. Set **Framework Preset** to Next.js
5. Add environment variable: `NEXT_PUBLIC_API_URL` = `https://media-basket-production.up.railway.app`
6. Deploy

Every push to `main` will auto-deploy to production.

---

## TypeScript Fixes Applied

The following fixes were applied to make the build succeed:

### 1. `src/lib/store.ts` — Added `role` to User interface

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role?: string;  // Added
  avatar_url?: string;
}
```

### 2. `src/components/BottomNav.tsx` — Fixed type comparison

```typescript
// Before (broken):
const isActive =
  href === "/profile"
    ? pathname === href
    : pathname.startsWith(href);

// After (fixed):
const isActive =
  href === "/tree"
    ? pathname === href || pathname.startsWith(href)
    : pathname.startsWith(href);
```

### 3. `src/components/TreeView.tsx` — Fixed function signature

```typescript
// Before (broken):
syncService(node.id, node.connectorType);

// After (fixed):
syncService(node.id);
```

### 4. `src/components/TreeView.tsx` — Fixed `flagged` property access

```typescript
// Before (broken):
const flaggedCount = serviceContent.filter((c) => c.flagged).length;
badge: item.flagged ? 1 : 0,
badgeType: item.flagged ? "flagged" : undefined,

// After (fixed):
const flaggedCount = serviceContent.filter((c) => c.metadata?.flagged).length;
badge: item.metadata?.flagged ? 1 : 0,
badgeType: item.metadata?.flagged ? "flagged" : undefined,
```

### 5. `src/sdk/index.ts` — Fixed type re-exports

```typescript
// Before (broken):
export { ConnectorPlugin, ConnectorManifest, ... } from "./connector";

// After (fixed):
export type { ConnectorManifest, AuthField, AuthConfig, AuthResult, ContentItem, PostResult, ServiceInstance, ConnectorPlugin } from "./connector";
export { BaseConnector, createManifest, hashContent } from "./connector";
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails with type errors | Check the TypeScript fixes above |
| `NEXT_PUBLIC_API_URL` not working | Must redeploy after setting env vars |
| CORS errors | Update `CORS_ORIGINS` on Railway backend |
| 404 on page refresh | Ensure `vercel.json` has rewrites for Next.js |
| Slow cold starts | Consider using Vercel Edge or upgrading plan |

---

## Vercel Limits (Free Plan)

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Build minutes | 6,000 minutes/month |
| Serverless Functions | 100 hours/month |
| Edge Functions | 1M invocations/month |
| Projects | Unlimited |
| Team members | Unlimited |
| Custom domains | 50 per project |
| SSL | Included |

---

## Related Files

- `MediaBasket_railway.md` — Backend deployment settings
- `ARCHITECTURE.md` — Full system design
- `ROADMAP.md` — Implementation plan
