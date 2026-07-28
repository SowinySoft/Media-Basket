from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.routes import auth, services, content, moderation, billing, health

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


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION}
