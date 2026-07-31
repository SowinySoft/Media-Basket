"""
Unified Content Ingestion Pipeline
Standardizes content from all connectors into a common format.

Stages:
1. trigger  — receive raw webhook/event payload
2. validate — ensure required fields present
3. dedup    — content_hash comparison to skip duplicates
4. map      — convert raw dict → UnifiedContent via connector processor
5. enrich   — ML sentiment/spam/tagging analysis
6. persist  — write to DB (ContentItem + ContentMetadata)
7. emit     — broadcast WebSocket notification
8. alert    — check sentiment thresholds, trigger alerts if needed
"""
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.logging import get_logger

logger = get_logger("content_pipeline")


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

    external_id: str
    content_type: ContentType
    parent_id: Optional[str] = None

    title: Optional[str] = None
    body: Optional[str] = None
    author: Optional[dict] = None
    media: Optional[list[dict]] = None

    url: Optional[str] = None
    platform_created_at: Optional[datetime] = None
    ingested_at: datetime = datetime.now(timezone.utc)

    likes: int = 0
    comments_count: int = 0
    shares: int = 0
    views: int = 0

    status: ContentStatus = ContentStatus.PENDING
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    spam_score: Optional[float] = None
    language: Optional[str] = None
    auto_tags: list[str] = []
    flagged: bool = False
    flag_reasons: list[str] = []

    content_hash: Optional[str] = None

    class Config:
        use_enum_values = True


class ContentIngestionPipeline:
    """Full 8-stage content ingestion pipeline."""

    def __init__(self, db: AsyncSession, org_id: str):
        self.db = db
        self.org_id = org_id
        self._processors = {}

    def register_processor(self, connector_type: str, processor):
        self._processors[connector_type] = processor

    # ── Stage 1: Trigger ────────────────────────────────────────────
    async def trigger(self, service_id: str, connector_type: str, raw_content: list[dict]) -> list[dict]:
        """Receive raw webhook payload. Returns list of raw items to process."""
        logger.info("pipeline_trigger", service_id=service_id, connector_type=connector_type, count=len(raw_content))
        return raw_content

    # ── Stage 2: Validate ───────────────────────────────────────────
    async def validate(self, raw_content: list[dict]) -> list[dict]:
        """Filter out items missing required fields."""
        valid = []
        for item in raw_content:
            if item.get("id") or item.get("external_id") or item.get("snippet"):
                valid.append(item)
            else:
                logger.warning("pipeline_validation_skip", item_keys=list(item.keys()))
        return valid

    # ── Stage 3: Dedup ─────────────────────────────────────────────
    async def dedup(self, items: list[UnifiedContent]) -> list[UnifiedContent]:
        """Skip items whose content_hash already exists in DB."""
        from app.models.models import ContentItem

        unique = []
        for item in items:
            h = self._compute_hash(item)
            item.content_hash = h

            existing = await self.db.execute(
                select(ContentItem).where(
                    ContentItem.org_id == self.org_id,
                    ContentItem.content_hash == h,
                )
            )
            if existing.scalar_one_or_none():
                logger.debug("pipeline_dedup_skip", external_id=item.external_id, hash=h[:12])
                continue
            unique.append(item)

        logger.info("pipeline_dedup", total=len(items), kept=len(unique))
        return unique

    # ── Stage 4: Map (process) ─────────────────────────────────────
    async def map_content(self, service_id: str, connector_type: str, raw_content: list[dict]) -> list[UnifiedContent]:
        """Convert raw dicts → UnifiedContent via connector processor."""
        processor = self._processors.get(connector_type)
        if not processor:
            raise ValueError(f"No processor registered for {connector_type}")

        unified = []
        for item in raw_content:
            content = processor(item)
            content.service_id = service_id
            content.connector_type = connector_type
            unified.append(content)
        return unified

    # ── Stage 5: Enrich ────────────────────────────────────────────
    async def enrich(self, content: UnifiedContent) -> UnifiedContent:
        """Enrich with ML analysis (sentiment, spam, tags). Gracefully degrades if ML is unavailable."""
        try:
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
        except ImportError:
            logger.debug("ml_unavailable_import", external_id=content.external_id)
        except Exception as exc:
            logger.warning("ml_enrichment_failed", external_id=content.external_id, error=str(exc))
        return content

    # ── Stage 6: Persist ───────────────────────────────────────────
    async def persist(self, items: list[UnifiedContent]) -> list[str]:
        """Write UnifiedContent to DB. Returns list of created ContentItem IDs."""
        from app.models.models import ContentItem, ContentMetadata

        created_ids = []
        for item in items:
            ci = ContentItem(
                org_id=self.org_id,
                service_instance_id=item.service_id,
                external_id=item.external_id,
                content_type=item.content_type,
                title=item.title,
                body=item.body,
                url=item.url,
                platform_created_at=item.platform_created_at,
                ingested_at=item.ingested_at,
                likes=item.likes,
                comments_count=item.comments_count,
                shares=item.shares,
                views=item.views,
                status=item.status,
                flagged=item.flagged,
                content_hash=item.content_hash,
            )
            self.db.add(ci)
            await self.db.flush()
            await self.db.refresh(ci)

            if item.sentiment or item.spam_score is not None or item.auto_tags:
                meta = ContentMetadata(
                    content_item_id=str(ci.id),
                    sentiment=item.sentiment,
                    sentiment_score=item.sentiment_score,
                    spam_score=item.spam_score,
                    language=item.language,
                    tags=item.auto_tags,
                )
                self.db.add(meta)

            created_ids.append(str(ci.id))

        logger.info("pipeline_persist", count=len(created_ids))
        return created_ids

    # ── Stage 7: Emit (WebSocket) ──────────────────────────────────
    async def emit(self, created_ids: list[str], connector_type: str):
        """Broadcast new-content WebSocket event."""
        try:
            from app.routes.websocket import notify_content_new
            for cid in created_ids:
                await notify_content_new(self.org_id, cid, connector_type)
        except Exception:
            pass

    # ── Stage 8: Alert ─────────────────────────────────────────────
    async def alert(self, items: list[UnifiedContent], created_ids: list[str]):
        """Check thresholds and trigger alerts for negative sentiment / spam."""
        from app.routes.websocket import notify_content_flagged

        for item, cid in zip(items, created_ids):
            if item.flagged:
                try:
                    await notify_content_flagged(
                        self.org_id, cid,
                        reason=", ".join(item.flag_reasons) if item.flag_reasons else "flagged",
                    )
                except Exception:
                    pass

    # ── Full pipeline run with retry ────────────────────────────────
    async def run(
        self,
        service_id: str,
        connector_type: str,
        raw_content: list[dict],
        max_retries: int = 3,
    ) -> list[str]:
        """Execute the full 8-stage pipeline with exponential backoff retry."""
        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                raw = await self.trigger(service_id, connector_type, raw_content)
                raw = await self.validate(raw)
                items = await self.map_content(service_id, connector_type, raw)
                items = [await self.enrich(i) for i in items]
                items = await self.dedup(items)
                created_ids = await self.persist(items)
                await self.emit(created_ids, connector_type)
                await self.alert(items, created_ids)
                return created_ids
            except Exception as exc:
                last_error = exc
                if attempt < max_retries:
                    wait = 2 ** attempt  # exponential backoff: 2s, 4s, 8s
                    logger.warning(
                        "pipeline_retry",
                        attempt=attempt,
                        max_retries=max_retries,
                        wait_seconds=wait,
                        error=str(exc),
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        "pipeline_failed",
                        attempts=attempt,
                        error=str(exc),
                        exc_info=True,
                    )
        raise last_error

    # ── Helpers ─────────────────────────────────────────────────────
    def _compute_hash(self, item: UnifiedContent) -> str:
        """Deterministic content hash for deduplication."""
        payload = f"{item.external_id}:{item.connector_type}:{item.org_id}"
        return hashlib.sha256(payload.encode()).hexdigest()


# ── Connector processors ────────────────────────────────────────────

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


def process_linkedin_post(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.POST,
        title=raw.get("title"),
        body=raw.get("commentary") or raw.get("text"),
        author={"name": raw.get("author", {}).get("name"), "id": raw.get("author", {}).get("id")},
        url=raw.get("url"),
        likes=int(raw.get("likesCount", 0)),
        comments_count=int(raw.get("commentsCount", 0)),
        shares=int(raw.get("sharesCount", 0)),
    )


def process_pinterest_pin(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("id", ""),
        content_type=ContentType.PIN,
        title=raw.get("title"),
        body=raw.get("description"),
        author={"name": raw.get("board", {}).get("owner", {}).get("username")},
        media=[{"type": "image", "url": raw.get("link")}],
        url=raw.get("link"),
    )


def process_snapchat_snap(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("media_id", ""),
        content_type=ContentType.VIDEO,
        title=raw.get("title"),
        body=raw.get("caption"),
    )


def process_bluesky_post(raw: dict) -> UnifiedContent:
    return UnifiedContent(
        external_id=raw.get("uri", ""),
        content_type=ContentType.POST,
        body=raw.get("record", {}).get("text"),
        author={"name": raw.get("author", {}).get("handle"), "id": raw.get("author", {}).get("did")},
        url=f"https://bsky.app/profile/{raw.get('author', {}).get('handle')}/post/{raw.get('uri', '').split('/')[-1]}",
        likes=int(raw.get("likeCount", 0)),
        comments_count=int(raw.get("replyCount", 0)),
        shares=int(raw.get("repostCount", 0)),
    )


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
    "linkedin": process_linkedin_post,
    "pinterest": process_pinterest_pin,
    "snapchat": process_snapchat_snap,
    "bluesky": process_bluesky_post,
}
