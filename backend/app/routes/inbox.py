"""Inbox / Notification routes — Gap 8: real notification system."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.core.database import get_db
from app.models.models import Notification
from app.routes.auth import get_current_user
from app.core.logging import get_logger
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

router = APIRouter()
logger = get_logger("inbox")


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    is_read: bool
    metadata_json: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread: int


class NotificationStatsResponse(BaseModel):
    total: int
    unread: int
    by_type: dict[str, int]


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    type: str | None = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    q = select(Notification).where(Notification.org_id == org_id)
    count_q = select(func.count(Notification.id)).where(Notification.org_id == org_id)

    if type:
        q = q.where(Notification.type == type)
        count_q = count_q.where(Notification.type == type)
    if unread_only:
        q = q.where(Notification.is_read == False)
        count_q = count_q.where(Notification.is_read == False)

    total = (await db.execute(count_q)).scalar() or 0
    unread = (await db.execute(
        select(func.count(Notification.id)).where(Notification.org_id == org_id, Notification.is_read == False)
    )).scalar() or 0

    result = await db.execute(
        q.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    )
    items = result.scalars().all()

    return NotificationListResponse(items=items, total=total, unread=unread)


@router.get("/stats", response_model=NotificationStatsResponse)
async def notification_stats(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    total = (await db.execute(
        select(func.count(Notification.id)).where(Notification.org_id == org_id)
    )).scalar() or 0
    unread = (await db.execute(
        select(func.count(Notification.id)).where(Notification.org_id == org_id, Notification.is_read == False)
    )).scalar() or 0

    rows = (await db.execute(
        select(Notification.type, func.count(Notification.id))
        .where(Notification.org_id == org_id)
        .group_by(Notification.type)
    )).all()
    by_type = {row[0]: row[1] for row in rows}

    return NotificationStatsResponse(total=total, unread=unread, by_type=by_type)


@router.post("/{notification_id}/read")
async def mark_read(
    org_id: str,
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.org_id == org_id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    await db.flush()
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.execute(
        update(Notification)
        .where(Notification.org_id == org_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.flush()
    return {"status": "ok"}


# ── Helper: create a notification (used by other modules) ───────────

async def create_notification(
    db: AsyncSession,
    org_id: str,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    user_id: str | None = None,
    metadata: dict | None = None,
) -> Notification:
    """Create a notification entry and return it."""
    n = Notification(
        org_id=org_id,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
        metadata_json=metadata or {},
    )
    db.add(n)
    await db.flush()
    return n
