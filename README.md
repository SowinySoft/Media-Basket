# Media Basket

All your media accounts in one basket.

## Quick Start

### With Docker

```bash
docker compose up
```

### With Podman

```bash
podman-compose -f podman-compose.yml up
```

### Ports

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

### Backend (Python 3.12+)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend (Node 20+)

```bash
cd frontend
npm install
npm run dev
```

## Sandbox Environment

If running in a sandbox (e.g. Dev Containers, Gitpod, Codespaces):

1. Services bind to `0.0.0.0` by default
2. Use the forwarded ports from your IDE
3. Update `CORS_ORIGINS` in `.env` if needed:
   ```
   CORS_ORIGINS=["http://localhost:3000","https://your-sandbox-url"]
   ```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system design.
See [ROADMAP.md](ROADMAP.md) for implementation plan.
