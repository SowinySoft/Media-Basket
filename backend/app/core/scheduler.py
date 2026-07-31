"""
Content Scheduling System
Schedule posts across all connected platforms
"""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class ScheduleStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScheduledPost(BaseModel):
    """A post scheduled for publishing"""
    id: Optional[str] = None
    org_id: str
    service_id: str
    connector_type: str
    
    # Content
    content: str
    media_urls: Optional[list[str]] = None
    reply_to: Optional[str] = None
    
    # Schedule
    scheduled_at: datetime
    status: ScheduleStatus = ScheduleStatus.PENDING
    
    # Metadata
    created_at: datetime = datetime.now(timezone.utc)
    published_at: Optional[datetime] = None
    error: Optional[str] = None
    external_id: Optional[str] = None
    
    class Config:
        use_enum_values = True


class ContentScheduler:
    """Schedule and publish content across platforms"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def schedule(self, post: ScheduledPost) -> ScheduledPost:
        """Schedule a post for publishing"""
        from app.models.models import ScheduledPost as ScheduledPostModel
        
        db_post = ScheduledPostModel(
            org_id=post.org_id,
            service_instance_id=post.service_id,
            connector_type=post.connector_type,
            content=post.content,
            media_urls=post.media_urls or [],
            reply_to=post.reply_to,
            scheduled_at=post.scheduled_at,
            status=ScheduleStatus.PENDING,
        )
        
        self.db.add(db_post)
        await self.db.flush()
        await self.db.refresh(db_post)
        
        post.id = str(db_post.id)
        return post
    
    async def cancel(self, post_id: str, org_id: str) -> bool:
        """Cancel a scheduled post"""
        from app.models.models import ScheduledPost as ScheduledPostModel
        from sqlalchemy import update
        
        result = await self.db.execute(
            update(ScheduledPostModel)
            .where(
                ScheduledPostModel.id == post_id,
                ScheduledPostModel.org_id == org_id,
                ScheduledPostModel.status.in_([ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED])
            )
            .values(status=ScheduleStatus.CANCELLED)
        )
        
        return result.rowcount > 0
    
    async def publish_now(self, post_id: str, org_id: str) -> dict:
        """Immediately publish a scheduled post"""
        from sqlalchemy import select as sa_select
        from app.models.models import ScheduledPost as ScheduledPostModel
        from app.connectors.registry import get_connector
        from app.core.vault import read_secret
        
        # Get the scheduled post
        result = await self.db.execute(
            sa_select(ScheduledPostModel).where(
                ScheduledPostModel.id == post_id,
                ScheduledPostModel.org_id == org_id,
            )
        )
        post = result.scalar_one_or_none()
        
        if not post:
            return {"error": "Post not found"}
        
        if post.status not in [ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED]:
            return {"error": f"Cannot publish post with status: {post.status}"}
        
        # Get connector and credentials
        connector = get_connector(post.connector_type)
        if not connector:
            return {"error": f"Connector not found: {post.connector_type}"}
        
        credentials = await read_secret(self.db, org_id, str(post.service_instance_id))
        if not credentials:
            return {"error": "No credentials found"}
        
        # Update status
        post.status = ScheduleStatus.PUBLISHING
        await self.db.flush()
        
        try:
            # Publish based on connector type
            token = credentials.get("access_token") or credentials.get("bot_token")
            await connector.respond(
                post.reply_to or "",
                post.content,
                token=token,
            )
            
            # Update status
            post.status = ScheduleStatus.PUBLISHED
            post.published_at = datetime.now(timezone.utc)
            await self.db.flush()
            
            return {"status": "published", "post_id": str(post.id)}
            
        except Exception as e:
            post.status = ScheduleStatus.FAILED
            post.error = str(e)
            await self.db.flush()
            return {"error": str(e)}
    
    async def get_pending(self, org_id: str) -> list[dict]:
        """Get all pending scheduled posts"""
        from app.models.models import ScheduledPost as ScheduledPostModel
        from sqlalchemy import select
        
        result = await self.db.execute(
            select(ScheduledPostModel)
            .where(
                ScheduledPostModel.org_id == org_id,
                ScheduledPostModel.status.in_([ScheduleStatus.PENDING, ScheduleStatus.SCHEDULED])
            )
            .order_by(ScheduledPostModel.scheduled_at)
        )
        
        posts = result.scalars().all()
        return [self._to_dict(p) for p in posts]
    
    async def check_due(self) -> list[dict]:
        """Check for posts that are due to be published"""
        from app.models.models import ScheduledPost as ScheduledPostModel
        from sqlalchemy import select
        
        result = await self.db.execute(
            select(ScheduledPostModel)
            .where(
                ScheduledPostModel.status == ScheduleStatus.SCHEDULED,
                ScheduledPostModel.scheduled_at <= datetime.now(timezone.utc)
            )
        )
        
        posts = result.scalars().all()
        return [self._to_dict(p) for p in posts]
    
    def _to_dict(self, post) -> dict:
        return {
            "id": str(post.id),
            "connector_type": post.connector_type,
            "content": post.content,
            "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
            "status": post.status,
            "published_at": post.published_at.isoformat() if post.published_at else None,
            "error": post.error,
        }
