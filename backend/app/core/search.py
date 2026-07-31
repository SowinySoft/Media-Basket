"""
Cross-Platform Search API
Unified search across all connected services
"""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class SearchFilters(BaseModel):
    """Standardized search filters"""
    query: Optional[str] = None
    content_types: Optional[list[str]] = None
    connector_types: Optional[list[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    sentiment: Optional[str] = None
    min_likes: Optional[int] = None
    max_likes: Optional[int] = None
    flagged_only: bool = False
    has_media: Optional[bool] = None
    language: Optional[str] = None


class SearchResults(BaseModel):
    """Standardized search results"""
    items: list[dict]
    total: int
    page: int = 1
    page_size: int = 50
    filters_applied: dict = {}


class CrossPlatformSearch:
    """Search across all connected services"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def search(self, org_id: str, filters: SearchFilters) -> SearchResults:
        """Search content across all connected services"""
        from sqlalchemy import select, and_, or_
        from app.models.models import ContentItem, ServiceInstance, ContentMetadata
        
        # Build query with optional join for metadata filters
        query = select(ContentItem).join(ServiceInstance)
        conditions = [ContentItem.org_id == org_id]
        
        # Filter by connector types
        if filters.connector_types:
            conditions.append(ServiceInstance.connector_type.in_(filters.connector_types))
        
        # Filter by content types
        if filters.content_types:
            conditions.append(ContentItem.content_type.in_(filters.content_types))
        
        # Text search
        if filters.query:
            search_term = f"%{filters.query}%"
            conditions.append(
                or_(
                    ContentItem.payload["title"].astext.ilike(search_term),
                    ContentItem.payload["body"].astext.ilike(search_term),
                    ContentItem.payload["text"].astext.ilike(search_term),
                    ContentItem.payload["message"].astext.ilike(search_term),
                    ContentItem.payload["content"].astext.ilike(search_term),
                )
            )
        
        # Date range
        if filters.date_from:
            conditions.append(ContentItem.ingested_at >= filters.date_from)
        if filters.date_to:
            conditions.append(ContentItem.ingested_at <= filters.date_to)
        
        # Join ContentMetadata for sentiment/flagged filters
        if filters.sentiment or filters.flagged_only:
            query = query.join(ContentMetadata, ContentItem.id == ContentMetadata.content_item_id)
        
        # Sentiment filter
        if filters.sentiment:
            conditions.append(ContentMetadata.sentiment == filters.sentiment)
        
        # Flagged only
        if filters.flagged_only:
            conditions.append(ContentMetadata.flagged == True)
        
        # Apply all conditions
        if conditions:
            query = query.where(and_(*conditions))
        
        # Execute
        result = await self.db.execute(query)
        items = result.scalars().unique().all()
        
        return SearchResults(
            items=[self._to_dict(item) for item in items],
            total=len(items),
            filters_applied=filters.model_dump(exclude_none=True),
        )
    
    async def aggregate(self, org_id: str) -> dict:
        """Get aggregate stats across all services"""
        from sqlalchemy import select, func
        from app.models.models import ContentItem, ServiceInstance, ContentMetadata
        
        # Total content
        total_query = select(func.count(ContentItem.id)).where(ContentItem.org_id == org_id)
        total_result = await self.db.execute(total_query)
        total = total_result.scalar() or 0
        
        # By connector type
        connector_query = (
            select(ServiceInstance.connector_type, func.count(ContentItem.id))
            .join(ContentItem)
            .where(ContentItem.org_id == org_id)
            .group_by(ServiceInstance.connector_type)
        )
        connector_result = await self.db.execute(connector_query)
        by_connector = dict(connector_result.all())
        
        # By content type
        content_type_query = (
            select(ContentItem.content_type, func.count(ContentItem.id))
            .where(ContentItem.org_id == org_id)
            .group_by(ContentItem.content_type)
        )
        content_type_result = await self.db.execute(content_type_query)
        by_content_type = dict(content_type_result.all())
        
        # Sentiment breakdown (join ContentMetadata)
        sentiment_query = (
            select(ContentMetadata.sentiment, func.count(ContentItem.id))
            .join(ContentItem, ContentMetadata.content_item_id == ContentItem.id)
            .where(ContentItem.org_id == org_id)
            .group_by(ContentMetadata.sentiment)
        )
        sentiment_result = await self.db.execute(sentiment_query)
        by_sentiment = {row[0] or "unknown": row[1] for row in sentiment_result.all()}
        
        return {
            "total_content": total,
            "by_connector": by_connector,
            "by_content_type": by_content_type,
            "by_sentiment": by_sentiment,
        }
    
    def _to_dict(self, item) -> dict:
        meta = item.metadata_record if hasattr(item, "metadata_record") else None
        return {
            "id": str(item.id),
            "external_id": item.external_id,
            "content_type": item.content_type,
            "service_id": str(item.service_instance_id),
            "payload": item.payload,
            "metadata": {
                "sentiment": meta.sentiment,
                "sentiment_score": meta.sentiment_score,
                "flagged": meta.flagged,
            } if meta else None,
            "ingested_at": item.ingested_at.isoformat() if item.ingested_at else None,
        }
