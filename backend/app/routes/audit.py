"""
Audit Log API
Track all user actions
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select, func
from app.models.models import AuditLog, User, Member
from app.core.logging import get_logger


logger = get_logger("audit")

router = APIRouter()


@router.get("")
async def get_audit_log(
    action: Optional[str] = Query(None, description="Filter by action"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    user_id: Optional[str] = Query(None, description="Filter by user"),
    days: int = Query(30, description="Number of days to look back"),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(AuditLog, User.name, User.email)
        .outerjoin(Member, AuditLog.member_id == Member.id)
        .outerjoin(User, Member.user_id == User.id)
        .where(
            AuditLog.org_id == org_id,
            AuditLog.timestamp >= start_date,
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    )

    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if user_id:
        query = query.where(Member.user_id == user_id)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "user_name": name or "System",
            "user_email": email,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log, name, email in rows
    ]


@router.get("/actions")
async def get_action_types(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(AuditLog.action).where(AuditLog.org_id == org_id).distinct()
    )
    return [row[0] for row in result.all()]


@router.get("/resources")
async def get_resource_types(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(AuditLog.resource_type).where(AuditLog.org_id == org_id).distinct()
    )
    return [row[0] for row in result.all()]


@router.get("/stats")
async def get_audit_stats(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Total count
    total_result = await db.execute(
        select(func.count(AuditLog.id))
        .where(AuditLog.org_id == org_id, AuditLog.timestamp >= start_date)
    )
    total = total_result.scalar() or 0

    # Group by action in SQL
    action_result = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id))
        .where(AuditLog.org_id == org_id, AuditLog.timestamp >= start_date)
        .group_by(AuditLog.action)
    )
    action_counts = {row[0]: row[1] for row in action_result.all()}

    return {
        "total": total,
        "by_action": action_counts,
        "period_days": days,
    }
