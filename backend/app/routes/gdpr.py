"""GDPR compliance — data export, account deletion, consent management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.core.database import get_db
from app.models.models import User, Member, ContentItem, AuditLog, Notification
from app.routes.auth import get_current_user
from app.core.logging import get_logger
from pydantic import BaseModel

router = APIRouter()
logger = get_logger("gdpr")


class DataExportResponse(BaseModel):
    profile: dict
    memberships: list[dict]
    content_count: int
    audit_count: int


@router.get("/me/data-export")
async def export_my_data(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 20 — Right to data portability. Export all user data."""
    user_id = current_user["sub"]

    # Profile
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "auth_provider": user.auth_provider,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

    # Memberships
    mem_result = await db.execute(select(Member).where(Member.user_id == user_id))
    memberships = [
        {"org_id": str(m.org_id), "role": m.role, "joined_at": m.joined_at.isoformat() if m.joined_at else None}
        for m in mem_result.scalars().all()
    ]

    # Content count
    content_count = (await db.execute(
        select(func.count(ContentItem.id)).where(ContentItem.org_id == current_user["org_id"])
    )).scalar() or 0

    # Audit count
    audit_count = (await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.org_id == current_user["org_id"])
    )).scalar() or 0

    logger.info("gdpr_data_export", user_id=user_id)
    return DataExportResponse(
        profile=profile, memberships=memberships,
        content_count=content_count, audit_count=audit_count,
    )


@router.delete("/me")
async def delete_my_account(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 17 — Right to erasure. Anonymize user data."""
    user_id = current_user["sub"]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Anonymize (don't hard delete to preserve referential integrity)
    user.email = f"deleted-{user_id}@anonymized.local"
    user.name = "Deleted User"
    user.hashed_password = None
    user.avatar_url = None
    user.settings = {}

    # Delete memberships
    await db.execute(delete(Member).where(Member.user_id == user_id))

    # Delete notifications
    await db.execute(delete(Notification).where(Notification.user_id == user_id))

    await db.commit()
    logger.info("gdpr_account_deleted", user_id=user_id)
    return {"status": "deleted", "message": "Account anonymized successfully"}
