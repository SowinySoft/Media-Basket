"""
Content Calendar API
Visual calendar view for scheduled/published content
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select, and_
from app.models.models import ScheduledPost, ContentItem, ServiceInstance
from app.core.logging import get_logger


logger = get_logger("calendar")

router = APIRouter()


@router.get("")
async def get_calendar(
    year: int = Query(..., description="Year"),
    month: int = Query(..., ge=1, le=12, description="Month"),
    connector_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    # Get first and last day of month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    # Fetch scheduled posts
    query = (
        select(ScheduledPost, ServiceInstance.connector_type, ServiceInstance.display_name)
        .join(ServiceInstance)
        .where(
            ScheduledPost.org_id == org_id,
            ScheduledPost.scheduled_at >= start_date,
            ScheduledPost.scheduled_at < end_date,
        )
        .order_by(ScheduledPost.scheduled_at)
    )
    if connector_type:
        query = query.where(ScheduledPost.connector_type == connector_type)

    result = await db.execute(query)
    rows = result.all()

    events = []
    for post, conn_type, display_name in rows:
        events.append({
            "id": str(post.id),
            "title": post.content[:80] + "..." if len(post.content) > 80 else post.content,
            "content": post.content,
            "connector_type": conn_type,
            "display_name": display_name,
            "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
            "status": post.status,
            "published_at": post.published_at.isoformat() if post.published_at else None,
            "media_urls": post.media_urls,
        })

    return {"events": events, "year": year, "month": month}


@router.get("/stats")
async def get_calendar_stats(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    # Count by status
    result = await db.execute(
        select(ScheduledPost.status)
        .where(
            ScheduledPost.org_id == org_id,
            ScheduledPost.scheduled_at >= start_date,
            ScheduledPost.scheduled_at < end_date,
        )
    )
    statuses = [row[0] for row in result.all()]

    return {
        "total": len(statuses),
        "pending": statuses.count("pending"),
        "published": statuses.count("published"),
        "failed": statuses.count("failed"),
    }
