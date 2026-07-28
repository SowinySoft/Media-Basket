# Media Basket

All your media accounts in one basket.

## Quick Start

```bash
docker compose up
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Vault UI: http://localhost:8200/ui (token: dev-token-root)
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

## First Time Setup

1. Open http://localhost:3000
2. Click "Sign Up"
3. Create your account (becomes org Owner)
4. Start adding services

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design.
See [ROADMAP.md](ROADMAP.md) for implementation plan.
