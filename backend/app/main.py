"""FastAPI application entry point."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.metrics import (
    http_requests_total,
    http_request_duration_seconds,
    metrics_endpoint,
)
from app.routes import (
    auth, services, content, moderation, billing, health, oauth, websocket,
    youtube, reddit, whatsapp, whatsapp_webhook, telegram, instagram, twitter,
    facebook, linkedin, tiktok, discord, slack, mastodon, pinterest, snapchat,
    bluesky, search, scheduler, templates, export, comments, activity, bulk,
    calendar, tasks, approval, audit, alerts, roi, suggestions, dashboards,
    webhooks_builder, ab_testing, competitors, org, members, plugins,
    inbox, data_retention, alerting, pgaudit, admin,
)
from app.middleware.tenant import TenantMiddleware
from app.middleware.csrf import CSRFMiddleware, SecurityHeadersMiddleware
from app.core.rate_limiter import RateLimitMiddleware, rate_limiter
import time

settings = get_settings()

setup_logging(log_level="DEBUG" if settings.DEBUG else "INFO")
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_up", app_version=settings.APP_VERSION)
    yield
    logger.info("shutting_down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="MediaBasket - Unified Social Media Management Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- OpenTelemetry Tracing ---
try:
    from app.core.tracing import setup_tracing, instrument_fastapi
    tracer = setup_tracing(settings.APP_NAME.replace(" ", "-").lower())
    instrument_fastapi(app)
    logger.info("opentelemetry_tracing_enabled")
except Exception as e:
    logger.warning("opentelemetry_tracing_disabled", error=str(e))
    tracer = None

# --- Middleware (order matters: first added = outermost) ---
app.add_middleware(RateLimitMiddleware, limiter=rate_limiter)
app.add_middleware(TenantMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request metrics + structlog middleware ---
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start

    path = request.url.path
    if "/orgs/" in path:
        parts = path.split("/")
        for i, part in enumerate(parts):
            if part == "orgs" and i + 1 < len(parts) and parts[i + 1] not in ("me",):
                parts[i + 1] = "{org_id}"
            if part == "services" and i + 1 < len(parts) and parts[i + 1] not in ("auth", "callback", "webhook"):
                parts[i + 1] = "{service_id}"
        path = "/".join(parts)

    http_requests_total.labels(
        method=request.method,
        path=path,
        status=response.status_code,
    ).inc()
    http_request_duration_seconds.labels(
        method=request.method,
        path=path,
    ).observe(duration)

    logger.info(
        "http_request",
        method=request.method,
        path=path,
        status=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )
    return response


# --- Prometheus metrics endpoint ---
@app.get("/metrics")
async def prometheus_metrics():
    return metrics_endpoint()


# --- Routers ---
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(org.router, prefix="/api/v1/orgs", tags=["orgs"])
app.include_router(members.router, prefix="/api/v1/orgs/{org_id}/members", tags=["members"])
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
app.include_router(discord.router, prefix="/api/v1/orgs/{org_id}/services", tags=["discord"])
app.include_router(slack.router, prefix="/api/v1/orgs/{org_id}/services", tags=["slack"])
app.include_router(mastodon.router, prefix="/api/v1/orgs/{org_id}/services", tags=["mastodon"])
app.include_router(pinterest.router, prefix="/api/v1/orgs/{org_id}/services", tags=["pinterest"])
app.include_router(snapchat.router, prefix="/api/v1/orgs/{org_id}/services", tags=["snapchat"])
app.include_router(bluesky.router, prefix="/api/v1/orgs/{org_id}/services", tags=["bluesky"])
app.include_router(search.router, prefix="/api/v1/orgs/{org_id}", tags=["search"])
app.include_router(scheduler.router, prefix="/api/v1/orgs/{org_id}", tags=["scheduler"])
app.include_router(templates.router, prefix="/api/v1/orgs/{org_id}/templates", tags=["templates"])
app.include_router(export.router, prefix="/api/v1/orgs/{org_id}/export", tags=["export"])
app.include_router(comments.router, prefix="/api/v1/orgs/{org_id}/content", tags=["comments"])
app.include_router(activity.router, prefix="/api/v1/orgs/{org_id}/activity", tags=["activity"])
app.include_router(bulk.router, prefix="/api/v1/orgs/{org_id}/bulk", tags=["bulk"])
app.include_router(calendar.router, prefix="/api/v1/orgs/{org_id}/calendar", tags=["calendar"])
app.include_router(tasks.router, prefix="/api/v1/orgs/{org_id}/tasks", tags=["tasks"])
app.include_router(approval.router, prefix="/api/v1/orgs/{org_id}/content", tags=["approval"])
app.include_router(audit.router, prefix="/api/v1/orgs/{org_id}/audit", tags=["audit"])
app.include_router(alerts.router, prefix="/api/v1/orgs/{org_id}/alerts", tags=["alerts"])
app.include_router(roi.router, prefix="/api/v1/orgs/{org_id}/roi", tags=["roi"])
app.include_router(suggestions.router, prefix="/api/v1/orgs/{org_id}/suggestions", tags=["suggestions"])
app.include_router(dashboards.router, prefix="/api/v1/orgs/{org_id}/dashboards", tags=["dashboards"])
app.include_router(webhooks_builder.router, prefix="/api/v1/orgs/{org_id}/webhooks", tags=["webhooks"])
app.include_router(ab_testing.router, prefix="/api/v1/orgs/{org_id}/ab-tests", tags=["ab-tests"])
app.include_router(competitors.router, prefix="/api/v1/orgs/{org_id}/competitors", tags=["competitors"])
app.include_router(plugins.router, prefix="/api/v1/orgs/{org_id}/plugins", tags=["plugins"])
app.include_router(inbox.router, prefix="/api/v1/orgs/{org_id}/notifications", tags=["inbox"])
app.include_router(data_retention.router, prefix="/api/v1/orgs/{org_id}/retention", tags=["data-retention"])
app.include_router(alerting.router, prefix="/api/v1/orgs/{org_id}/alerting", tags=["alerting"])
app.include_router(pgaudit.router, prefix="/api/v1/orgs/{org_id}/audit", tags=["pgaudit"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION}
