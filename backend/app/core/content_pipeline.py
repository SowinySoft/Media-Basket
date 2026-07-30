"""
Unified Content Ingestion Pipeline
Standardizes content from all connectors into a common format
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class ContentType(str, Enum):
    VIDEO = "video"
    POST = "post"
    COMMENT = "comment"
    MESSAGE = "message"
    STORY = "story"
    TWEET = "tweet"
    PIN = "pin"
    STATUS = "status"
    NOTIFICATION = "notification"
    UNKNOWN = "unknown"


class ContentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FLAGGED = "flagged"
    DELETED = "deleted"
    HIDDEN = "hidden"


class UnifiedContent(BaseModel):
    """Standardized content format across all connectors"""
    id: Optional[str] = None
    org_id: str
    service_id: str
    connector_type: str
    
    # Content identification
    external_id: str
    content_type: ContentType
    parent_id: Optional[str] = None
    
    # Content data
    title: Optional[str] = None
    body: Optional[str] = None
    author: Optional[dict] = None
    media: Optional[list[dict]] = None
    
    # Metadata
    url: Optional[str] = None
    platform_created_at: Optional[datetime] = None
    ingested_at: datetime = datetime.utcnow()
    
    # Engagement metrics
    likes: int = 0
    comments_count: int = 0
    shares: int = 0
    views: int = 0
    
    # Moderation
    status: ContentStatus = ContentStatus.PENDING
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    spam_score: Optional[float] = None
    language: Optional[str] = None
    auto_tags: list[str] = []
    flagged: bool = False
    flag_reasons: list[str] = []
    
    class Config:
        use_enum_values = True


class ContentIngestionPipeline:
    """Processes content from connectors into unified format"""
    
    def __init__(self, db_session):
        self.db = db_session
        self._processors = {}
    
    def register_processor(self, connector_type: str, processor):
        """Register a content processor for a connector type"""
        self._processors[connector_type] = processor
    
    async def ingest(self, service_id: str, connector_type: str, raw_content: list[dict]) -> list[UnifiedContent]:
        """Ingest raw content from a connector"""
        processor = self._processors.get(connector_type)
        if not processor:
            raise ValueError(f"No processor registered for {connector_type}")
        
        unified_items = []
        for item in raw_content:
            unified = processor(item)
            unified.service_id = service_id
            unified.connector_type = connector_type
            unified_items.append(unified)
        
        return unified_items
    
    async def enrich(self, content: UnifiedContent) -> UnifiedContent:
        """Enrich content with ML analysis"""
        from app.ml.analyzer import analyze_text
        
        if content.body:
            analysis = await analyze_text(content.body)
            content.sentiment = analysis.get("sentiment")
            content.sentiment_score = analysis.get("sentiment_score")
            content.spam_score = analysis.get("spam_score")
            content.language = analysis.get("language")
            content.auto_tags = analysis.get("tags", [])
            content.flagged = analysis.get("flagged", False)
            content.flag_reasons = analysis.get("flag_reasons", [])
        
        return content


# Standardized processors for each connector
def process_youtube_video(raw: dict) -> UnifiedContent:
    snippet = raw.get("snippet", {})
    stats = raw.get("statistics", {})
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.VIDEO,
        title=snippet.get("title"),
        body=snippet.get("description"),
        author={"name": snippet.get("channelTitle"), "id": snippet.get("channelId")},
        url=f"https://youtube.com/watch?v={raw.get('id')}",
        platform_created_at=snippet.get("publishedAt"),
        likes=int(stats.get("likeCount", 0)),
        comments_count=int(stats.get("commentCount", 0)),
        views=int(stats.get("viewCount", 0)),
    )


def process_reddit_post(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.POST,
        title=raw.get("title"),
        body=raw.get("selftext") or raw.get("body"),
        author={"name": raw.get("author"), "id": raw.get("author_fullname")},
        url=raw.get("url"),
        likes=int(raw.get("score", 0)),
        comments_count=int(raw.get("num_comments", 0)),
    )


def process_telegram_message(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=str(raw.get("message_id", "")),
        content_type=ContentType.MESSAGE,
        body=raw.get("text"),
        author={"name": raw.get("from", {}).get("username"), "id": str(raw.get("from", {}).get("id"))},
        platform_created_at=datetime.fromtimestamp(raw.get("date", 0)),
    )


def process_instagram_post(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.POST,
        body=raw.get("caption"),
        author={"name": raw.get("username")},
        media=[{"type": raw.get("media_type"), "url": raw.get("media_url")}],
        url=raw.get("permalink"),
        platform_created_at=raw.get("timestamp"),
    )


def process_twitter_tweet(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.TWEET,
        body=raw.get("text"),
        author={"name": raw.get("author", {}).get("username")},
        url=f"https://twitter.com/i/status/{raw.get('id')}",
        platform_created_at=raw.get("created_at"),
    )


def process_facebook_post(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.POST,
        body=raw.get("message"),
        author=raw.get("from"),
        platform_created_at=raw.get("created_time"),
    )


def process_discord_message(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.MESSAGE,
        body=raw.get("content"),
        author={"name": raw.get("author", {}).get("username"), "id": raw.get("author", {}).get("id")},
        platform_created_at=raw.get("timestamp"),
    )


def process_slack_message(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("ts", ""),
        content_type=ContentType.MESSAGE,
        body=raw.get("text"),
        author={"name": raw.get("user")},
        platform_created_at=datetime.fromtimestamp(float(raw.get("ts", 0))),
    )


def process_mastodon_status(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.STATUS,
        body=raw.get("content"),
        author={"name": raw.get("account", {}).get("display_name"), "id": raw.get("account", {}).get("id")},
        url=raw.get("url"),
        platform_created_at=raw.get("created_at"),
        likes=int(raw.get("favourites_count", 0)),
        shares=int(raw.get("reblogs_count", 0)),
        comments_count=int(raw.get("replies_count", 0)),
    )


def process_tiktok_video(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.VIDEO,
        title=raw.get("title"),
        likes=int(raw.get("like_count", 0)),
        comments_count=int(raw.get("comment_count", 0)),
        shares=int(raw.get("share_count", 0)),
        platform_created_at=datetime.fromtimestamp(raw.get("create_time", 0)),
    )


# Register all processors
CONTENT_PROCESSORS = {
    "youtube": process_youtube_video,
    "reddit": process_reddit_post,
    "telegram": process_telegram_message,
    "instagram": process_instagram_post,
    "twitter": process_twitter_tweet,
    "facebook": process_facebook_post,
    "discord": process_discord_message,
    "slack": process_slack_message,
    "mastodon": process_mastodon_status,
    "tiktok": process_tiktok_video,
}
