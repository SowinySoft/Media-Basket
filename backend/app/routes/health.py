from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import get_settings
from app.core.logging import get_logger


logger = get_logger("health")
router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    checks = {}

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception:
        checks["database"] = "unhealthy"
        logger.exception("health_db_check_failed")

    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
            r.ping()
            checks["redis"] = "healthy"
        except Exception:
            checks["redis"] = "unavailable (non-critical)"
            logger.warning("health_redis_check_failed")
    else:
        checks["redis"] = "not configured (non-critical)"

    from app.celery_app import celery_app
    checks["celery"] = "available" if celery_app else "unavailable (tasks run inline)"

    status = "healthy" if checks.get("database") == "healthy" else "degraded"
    return {"status": status, **checks}


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
