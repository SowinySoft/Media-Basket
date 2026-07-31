"""Admin routes — Gap 25: system overview, user management, health."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.models.models import Organization, User, Member, ServiceInstance, ContentItem, Plugin, VaultAuditLog
from app.routes.auth import get_current_user
from pydantic import BaseModel
from datetime import datetime
from app.core.logging import get_logger


logger = get_logger("admin")
router = APIRouter()


class SystemStatsResponse(BaseModel):
    organizations: int
    users: int
    members: int
    services: int
    content_items: int
    plugins: int
    vault_operations: int


class UserSummary(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime | None = None
    org_count: int = 0


@router.get("/stats", response_model=SystemStatsResponse)
async def system_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get system-wide stats. Admin only."""
    if current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    orgs = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    members = (await db.execute(select(func.count(Member.id)))).scalar() or 0
    services = (await db.execute(select(func.count(ServiceInstance.id)))).scalar() or 0
    content = (await db.execute(select(func.count(ContentItem.id)))).scalar() or 0
    plugins = (await db.execute(select(func.count(Plugin.id)))).scalar() or 0
    vault_ops = (await db.execute(select(func.count(VaultAuditLog.id)))).scalar() or 0

    return SystemStatsResponse(
        organizations=orgs, users=users, members=members,
        services=services, content_items=content,
        plugins=plugins, vault_operations=vault_ops,
    )


@router.get("/users", response_model=list[UserSummary])
async def list_users(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users. Admin only."""
    if current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    summaries = []
    for u in users:
        org_count = (await db.execute(
            select(func.count(Member.id)).where(Member.user_id == u.id)
        )).scalar() or 0
        summaries.append(UserSummary(
            id=str(u.id), email=u.email, name=u.name,
            created_at=u.created_at, org_count=org_count,
        ))
    return summaries


@router.get("/health")
async def system_health(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """System health check. Admin only."""
    if current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    # Check DB connectivity
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # Check Redis
    redis_ok = False
    try:
        import redis.asyncio as aioredis
        from app.core.config import get_settings

        settings = get_settings()
        if settings.REDIS_URL:
            r = aioredis.from_url(settings.REDIS_URL)
            await r.ping()
            redis_ok = True
            await r.close()
    except Exception:
        pass

    # Check pgAudit
    pgaudit_ok = False
    try:
        result = await db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'pgaudit'"))
        pgaudit_ok = result.scalar() is not None
    except Exception:
        pass

    return {
        "database": "ok" if db_ok else "error",
        "redis": "ok" if redis_ok else "unavailable",
        "pgaudit": "installed" if pgaudit_ok else "not_installed",
        "status": "healthy" if db_ok else "degraded",
    }
