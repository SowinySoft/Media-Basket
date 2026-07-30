from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.routes import auth, services, content, moderation, billing, health, oauth, websocket, youtube, reddit, whatsapp, whatsapp_webhook, telegram, instagram, twitter, facebook, linkedin, tiktok
from app.middleware.tenant import TenantMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(TenantMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(services.router, prefix="/api/v1/orgs/{org_id}/services", tags=["services"])
app.include_router(content.router, prefix="/api/v1/orgs/{org_id}/content", tags=["content"])
app.include_router(moderation.router, prefix="/api/v1/orgs/{org_id}/moderation", tags=["moderation"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(oauth.router, prefix="/api/v1/services", tags=["oauth"])
app.include_router(websocket.router, prefix="/api/v1", tags=["websocket"])
app.include_router(youtube.router, prefix="/api/v1/orgs/{org_id}/services", tags=["youtube"])
app.include_router(reddit.router, prefix="/api/v1/orgs/{org_id}/services", tags=["reddit"])
app.include_router(whatsapp.router, prefix="/api/v1/orgs/{org_id}/services", tags=["whatsapp"])
app.include_router(whatsapp_webhook.router, prefix="/api/v1/services", tags=["webhook"])
app.include_router(telegram.router, prefix="/api/v1/orgs/{org_id}/services", tags=["telegram"])
app.include_router(instagram.router, prefix="/api/v1/orgs/{org_id}/services", tags=["instagram"])
app.include_router(twitter.router, prefix="/api/v1/orgs/{org_id}/services", tags=["twitter"])
app.include_router(facebook.router, prefix="/api/v1/orgs/{org_id}/services", tags=["facebook"])
app.include_router(linkedin.router, prefix="/api/v1/orgs/{org_id}/services", tags=["linkedin"])
app.include_router(tiktok.router, prefix="/api/v1/orgs/{org_id}/services", tags=["tiktok"])


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION}
