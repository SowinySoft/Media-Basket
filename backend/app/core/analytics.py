"""
Analytics and Reporting API
Cross-platform analytics and insights
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel


class TimeRange(BaseModel):
    """Time range for analytics"""
    start: datetime
    end: datetime
    
    @classmethod
    def last_7_days(cls):
        now = datetime.now(timezone.utc)
        return cls(start=now - timedelta(days=7), end=now)
    
    @classmethod
    def last_30_days(cls):
        now = datetime.now(timezone.utc)
        return cls(start=now - timedelta(days=30), end=now)
    
    @classmethod
    def last_90_days(cls):
        now = datetime.now(timezone.utc)
        return cls(start=now - timedelta(days=90), end=now)


class AnalyticsSummary(BaseModel):
    """Summary analytics across all platforms"""
    total_content: int = 0
    total_engagement: int = 0
    avg_sentiment_score: float = 0.0
    sentiment_breakdown: dict = {}
    top_content_types: dict = {}
    top_connector_types: dict = {}
    engagement_over_time: list[dict] = []
    top_posts: list[dict] = []
    flagged_content: int = 0


class ConnectorAnalytics(BaseModel):
    """Analytics for a specific connector"""
    connector_type: str
    total_content: int = 0
    total_engagement: int = 0
    avg_sentiment: float = 0.0
    top_posts: list[dict] = []
    engagement_rate: float = 0.0


class AnalyticsEngine:
    """Generate analytics across all platforms"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def get_summary(self, org_id: str, time_range: TimeRange = None) -> AnalyticsSummary:
        """Get summary analytics across all platforms"""
        if not time_range:
            time_range = TimeRange.last_30_days()
        
        from sqlalchemy import select, func
        from app.models.models import ContentItem, ServiceInstance, ContentMetadata
        
        # Total content
        total_query = (
            select(func.count(ContentItem.id))
            .where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
        )
        total_result = await self.db.execute(total_query)
        total_content = total_result.scalar() or 0
        
        # Sentiment breakdown (join ContentMetadata)
        sentiment_query = (
            select(
                ContentMetadata.sentiment,
                func.count(ContentItem.id)
            )
            .join(ContentItem, ContentMetadata.content_item_id == ContentItem.id)
            .where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
            .group_by(ContentMetadata.sentiment)
        )
        sentiment_result = await self.db.execute(sentiment_query)
        sentiment_breakdown = {row[0] or "unknown": row[1] for row in sentiment_result.all()}
        
        # By connector type
        connector_query = (
            select(ServiceInstance.connector_type, func.count(ContentItem.id))
            .join(ContentItem)
            .where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
            .group_by(ServiceInstance.connector_type)
        )
        connector_result = await self.db.execute(connector_query)
        top_connector_types = dict(connector_result.all())
        
        # By content type
        content_type_query = (
            select(ContentItem.content_type, func.count(ContentItem.id))
            .where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
            .group_by(ContentItem.content_type)
        )
        content_type_result = await self.db.execute(content_type_query)
        top_content_types = dict(content_type_result.all())
        
        # Flagged content (join ContentMetadata)
        flagged_query = (
            select(func.count(ContentItem.id))
            .join(ContentMetadata, ContentMetadata.content_item_id == ContentItem.id)
            .where(
                ContentItem.org_id == org_id,
                ContentMetadata.flagged == True,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
        )
        flagged_result = await self.db.execute(flagged_query)
        flagged_content = flagged_result.scalar() or 0
        
        return AnalyticsSummary(
            total_content=total_content,
            sentiment_breakdown=sentiment_breakdown,
            top_content_types=top_content_types,
            top_connector_types=top_connector_types,
            flagged_content=flagged_content,
        )
    
    async def get_connector_analytics(self, org_id: str, connector_type: str, time_range: TimeRange = None) -> ConnectorAnalytics:
        """Get analytics for a specific connector"""
        if not time_range:
            time_range = TimeRange.last_30_days()
        
        from sqlalchemy import select, func
        from app.models.models import ContentItem, ServiceInstance, ContentMetadata
        
        # Get service IDs for this connector
        service_query = (
            select(ServiceInstance.id)
            .where(
                ServiceInstance.org_id == org_id,
                ServiceInstance.connector_type == connector_type,
            )
        )
        service_result = await self.db.execute(service_query)
        service_ids = [str(r[0]) for r in service_result.all()]
        
        if not service_ids:
            return ConnectorAnalytics(connector_type=connector_type)
        
        # Total content
        total_query = (
            select(func.count(ContentItem.id))
            .where(
                ContentItem.service_instance_id.in_(service_ids),
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
        )
        total_result = await self.db.execute(total_query)
        total_content = total_result.scalar() or 0
        
        # Average sentiment (join ContentMetadata)
        sentiment_query = (
            select(func.avg(ContentMetadata.sentiment_score))
            .join(ContentItem, ContentMetadata.content_item_id == ContentItem.id)
            .where(
                ContentItem.service_instance_id.in_(service_ids),
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
        )
        sentiment_result = await self.db.execute(sentiment_query)
        avg_sentiment = sentiment_result.scalar() or 0.0
        
        return ConnectorAnalytics(
            connector_type=connector_type,
            total_content=total_content,
            avg_sentiment=float(avg_sentiment),
        )
    
    async def get_engagement_timeline(self, org_id: str, time_range: TimeRange = None) -> list[dict]:
        """Get engagement over time"""
        if not time_range:
            time_range = TimeRange.last_30_days()
        
        from sqlalchemy import select, func, cast, Date
        from app.models.models import ContentItem
        
        query = (
            select(
                cast(ContentItem.ingested_at, Date).label("date"),
                func.count(ContentItem.id).label("count")
            )
            .where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at.between(time_range.start, time_range.end)
            )
            .group_by(cast(ContentItem.ingested_at, Date))
            .order_by(cast(ContentItem.ingested_at, Date))
        )
        
        result = await self.db.execute(query)
        return [{"date": str(r.date), "count": r.count} for r in result.all()]
