"""
ROI Tracking API
Track clicks/conversions per post with UTM parameters
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select, func
from app.models.models import TrackingEvent, ContentItem

router = APIRouter()


@router.post("/track")
async def track_event(
    content_item_id: str,
    event_type: str,  # click, view, conversion
    source: Optional[str] = None,
    utm_source: Optional[str] = None,
    utm_medium: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    event = TrackingEvent(
        org_id=org_id,
        content_item_id=content_item_id,
        event_type=event_type,
        source=source,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
    )
    db.add(event)
    await db.commit()
    return {"ok": True}


@router.get("/summary")
async def get_roi_summary(
    days: int = Query(30),
    connector_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    start_date = datetime.utcnow() - timedelta(days=days)

    # Count events by type
    result = await db.execute(
        select(TrackingEvent.event_type, func.count(TrackingEvent.id))
        .where(
            TrackingEvent.org_id == org_id,
            TrackingEvent.created_at >= start_date,
        )
        .group_by(TrackingEvent.event_type)
    )
    event_counts = {row[0]: row[1] for row in result.all()}

    # Count by UTM source
    utm_result = await db.execute(
        select(TrackingEvent.utm_source, func.count(TrackingEvent.id))
        .where(
            TrackingEvent.org_id == org_id,
            TrackingEvent.created_at >= start_date,
            TrackingEvent.utm_source.isnot(None),
        )
        .group_by(TrackingEvent.utm_source)
    )
    utm_sources = {row[0]: row[1] for row in utm_result.all()}

    # Count by UTM campaign
    campaign_result = await db.execute(
        select(TrackingEvent.utm_campaign, func.count(TrackingEvent.id))
        .where(
            TrackingEvent.org_id == org_id,
            TrackingEvent.created_at >= start_date,
            TrackingEvent.utm_campaign.isnot(None),
        )
        .group_by(TrackingEvent.utm_campaign)
    )
    campaigns = {row[0]: row[1] for row in campaign_result.all()}

    return {
        "period_days": days,
        "total_events": sum(event_counts.values()),
        "by_type": event_counts,
        "by_utm_source": utm_sources,
        "by_campaign": campaigns,
    }


@router.get("/content/{content_item_id}")
async def get_content_roi(
    content_item_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(TrackingEvent.event_type, func.count(TrackingEvent.id))
        .where(
            TrackingEvent.org_id == org_id,
            TrackingEvent.content_item_id == content_item_id,
        )
        .group_by(TrackingEvent.event_type)
    )
    event_counts = {row[0]: row[1] for row in result.all()}

    return {
        "content_item_id": content_item_id,
        "total_events": sum(event_counts.values()),
        "by_type": event_counts,
    }


@router.get("/generate-utm")
async def generate_utm(
    source: str,
    medium: str,
    campaign: str,
    content: Optional[str] = None,
):
    params = [
        f"utm_source={source}",
        f"utm_medium={medium}",
        f"utm_campaign={campaign}",
    ]
    if content:
        params.append(f"utm_content={content}")
    return {"utm_string": "&".join(params)}
