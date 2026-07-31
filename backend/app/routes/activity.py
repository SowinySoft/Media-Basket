"""
Activity Feed API
Real-time team activity stream
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import ActivityLog, User, Member
from app.core.logging import get_logger


logger = get_logger("activity")

router = APIRouter()


@router.get("")
async def get_activity(
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    query = (
        select(ActivityLog, User.name, User.email)
        .outerjoin(Member, ActivityLog.member_id == Member.id)
        .outerjoin(User, Member.user_id == User.id)
        .where(ActivityLog.org_id == org_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )

    if action_type:
        query = query.where(ActivityLog.action == action_type)
    if entity_type:
        query = query.where(ActivityLog.entity_type == entity_type)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(a.id),
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": str(a.entity_id) if a.entity_id else None,
            "details": a.details,
            "user_name": name or "System",
            "user_email": email,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a, name, email in rows
    ]


@router.post("")
async def log_activity(
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[dict] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    member_id = current_user.get("member_id")

    log = ActivityLog(
        org_id=org_id,
        member_id=member_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(log)
    await db.commit()
    return {"ok": True}
