"""
Unified Search API
Cross-platform search across all connected services
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.search import CrossPlatformSearch, SearchFilters
from app.core.api_response import success_response, paginated_response
from app.core.database import get_db

router = APIRouter()


@router.get("/search")
async def search_content(
    q: Optional[str] = Query(None, description="Search query"),
    content_types: Optional[str] = Query(None, description="Comma-separated content types"),
    connector_types: Optional[str] = Query(None, description="Comma-separated connector types"),
    date_from: Optional[datetime] = Query(None, description="Start date"),
    date_to: Optional[datetime] = Query(None, description="End date"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment"),
    flagged_only: bool = Query(False, description="Show only flagged content"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Search content across all connected services"""
    org_id = current_user["org_id"]
    
    filters = SearchFilters(
        query=q,
        content_types=content_types.split(",") if content_types else None,
        connector_types=connector_types.split(",") if connector_types else None,
        date_from=date_from,
        date_to=date_to,
        sentiment=sentiment,
        flagged_only=flagged_only,
    )
    
    search = CrossPlatformSearch(db)
    results = await search.search(org_id, filters)
    
    return paginated_response(
        data=results.items,
        total=results.total,
        page=page,
        page_size=page_size,
    )


@router.get("/analytics/summary")
async def get_analytics_summary(
    days: int = Query(30, description="Number of days"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get summary analytics across all platforms"""
    from app.core.analytics import AnalyticsEngine, TimeRange
    
    org_id = current_user["org_id"]
    time_range = TimeRange(
        start=datetime.utcnow() - __import__("datetime").timedelta(days=days),
        end=datetime.utcnow()
    )
    
    engine = AnalyticsEngine(db)
    summary = await engine.get_summary(org_id, time_range)
    
    return success_response(data=summary.dict())


@router.get("/analytics/connector/{connector_type}")
async def get_connector_analytics(
    connector_type: str,
    days: int = Query(30, description="Number of days"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get analytics for a specific connector"""
    from app.core.analytics import AnalyticsEngine, TimeRange
    
    org_id = current_user["org_id"]
    time_range = TimeRange(
        start=datetime.utcnow() - __import__("datetime").timedelta(days=days),
        end=datetime.utcnow()
    )
    
    engine = AnalyticsEngine(db)
    analytics = await engine.get_connector_analytics(org_id, connector_type, time_range)
    
    return success_response(data=analytics.dict())


@router.get("/analytics/timeline")
async def get_engagement_timeline(
    days: int = Query(30, description="Number of days"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get engagement over time"""
    from app.core.analytics import AnalyticsEngine, TimeRange
    
    org_id = current_user["org_id"]
    time_range = TimeRange(
        start=datetime.utcnow() - __import__("datetime").timedelta(days=days),
        end=datetime.utcnow()
    )
    
    engine = AnalyticsEngine(db)
    timeline = await engine.get_engagement_timeline(org_id, time_range)
    
    return success_response(data=timeline)


@router.get("/aggregate")
async def get_aggregate_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get aggregate stats across all services"""
    from app.core.search import CrossPlatformSearch
    
    org_id = current_user["org_id"]
    search = CrossPlatformSearch(db)
    stats = await search.aggregate(org_id)
    
    return success_response(data=stats)
