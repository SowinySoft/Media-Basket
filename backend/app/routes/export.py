"""
Data Export API
Export analytics to CSV/PDF
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timedelta
from app.routes.auth import get_current_user
from app.core.database import get_db

router = APIRouter()


@router.get("/csv")
async def export_csv(
    content_type: Optional[str] = Query(None, description="Filter by content type"),
    connector_type: Optional[str] = Query(None, description="Filter by connector type"),
    days: int = Query(30, description="Number of days"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Export content to CSV"""
    import csv
    import io
    from sqlalchemy import select
    from app.models.models import ContentItem, ServiceInstance
    
    org_id = current_user["org_id"]
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = (
        select(ContentItem, ServiceInstance.connector_type)
        .join(ServiceInstance)
        .where(
            ContentItem.org_id == org_id,
            ContentItem.ingested_at >= start_date
        )
    )
    
    if content_type:
        query = query.where(ContentItem.content_type == content_type)
    if connector_type:
        query = query.where(ServiceInstance.connector_type == connector_type)
    
    result = await db.execute(query)
    items = result.all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "External ID", "Content Type", "Connector Type",
        "Title", "Body", "Likes", "Comments", "Shares", "Views",
        "Sentiment", "Spam Score", "Created At"
    ])
    
    # Data
    for item, conn_type in items:
        payload = item.payload or {}
        metadata = item.metadata_ or {}
        
        writer.writerow([
            str(item.id),
            item.external_id,
            item.content_type,
            conn_type,
            payload.get("title", ""),
            payload.get("body", "") or payload.get("text", "") or payload.get("message", ""),
            payload.get("likes", 0),
            payload.get("comments_count", 0) or payload.get("num_comments", 0),
            payload.get("shares", 0) or payload.get("reblogs_count", 0),
            payload.get("views", 0) or payload.get("viewCount", 0),
            metadata.get("sentiment", ""),
            metadata.get("spam_score", 0),
            item.ingested_at.isoformat() if item.ingested_at else "",
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=mediabasket_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )


@router.get("/json")
async def export_json(
    content_type: Optional[str] = Query(None),
    connector_type: Optional[str] = Query(None),
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Export content to JSON"""
    import json
    from sqlalchemy import select
    from app.models.models import ContentItem, ServiceInstance
    
    org_id = current_user["org_id"]
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = (
        select(ContentItem, ServiceInstance.connector_type)
        .join(ServiceInstance)
        .where(
            ContentItem.org_id == org_id,
            ContentItem.ingested_at >= start_date
        )
    )
    
    if content_type:
        query = query.where(ContentItem.content_type == content_type)
    if connector_type:
        query = query.where(ServiceInstance.connector_type == connector_type)
    
    result = await db.execute(query)
    items = result.all()
    
    export_data = []
    for item, conn_type in items:
        export_data.append({
            "id": str(item.id),
            "external_id": item.external_id,
            "content_type": item.content_type,
            "connector_type": conn_type,
            "payload": item.payload,
            "metadata": item.metadata_,
            "ingested_at": item.ingested_at.isoformat() if item.ingested_at else None,
        })
    
    return StreamingResponse(
        iter([json.dumps(export_data, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=mediabasket_export_{datetime.utcnow().strftime('%Y%m%d')}.json"}
    )


@router.get("/analytics/csv")
async def export_analytics_csv(
    days: int = Query(30),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Export analytics summary to CSV"""
    import csv
    import io
    from app.core.analytics import AnalyticsEngine, TimeRange
    
    org_id = current_user["org_id"]
    time_range = TimeRange(
        start=datetime.utcnow() - timedelta(days=days),
        end=datetime.utcnow()
    )
    
    engine = AnalyticsEngine(db)
    summary = await engine.get_summary(org_id, time_range)
    timeline = await engine.get_engagement_timeline(org_id, time_range)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Summary
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Total Content", summary.total_content])
    writer.writerow(["Flagged Content", summary.flagged_content])
    writer.writerow([])
    
    # Sentiment breakdown
    writer.writerow(["Sentiment", "Count"])
    for sentiment, count in summary.sentiment_breakdown.items():
        writer.writerow([sentiment or "unknown", count])
    writer.writerow([])
    
    # Timeline
    writer.writerow(["Date", "Content Count"])
    for entry in timeline:
        writer.writerow([entry["date"], entry["count"]])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=mediabasket_analytics_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )
