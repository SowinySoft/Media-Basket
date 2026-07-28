import json
import hashlib
import asyncio
from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.core.vault import read_secret
from app.models.models import ServiceInstance, ContentItem, ContentMetadata
from app.connectors.registry import get_connector


def compute_hash(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def run_async(coro):
    """Run an async function from sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(name="tasks.sync_service", bind=True, max_retries=3)
def sync_service(self, service_id: str, org_id: str):
    return run_async(_sync_service(service_id, org_id))


async def _sync_service(service_id: str, org_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ServiceInstance).where(ServiceInstance.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            return {"error": "Service not found"}

        connector = get_connector(service.connector_type)
        if not connector:
            return {"error": f"Unknown connector: {service.connector_type}"}

        credentials = read_secret(org_id, service_id)
        if not credentials:
            return {"error": "No credentials found"}

        access_token = credentials.get("access_token")
        items_fetched = 0

        fetch_types = {
            "youtube": ["videos"],
            "reddit": ["posts", "comments"],
            "whatsapp": ["conversations"],
        }

        for fetch_type in fetch_types.get(service.connector_type, []):
            items = await connector.fetch({"access_token": access_token, "type": fetch_type})
            for item in items:
                content_hash = compute_hash(item["payload"])
                existing = await db.execute(
                    select(ContentItem).where(ContentItem.content_hash == content_hash)
                )
                if existing.scalar_one_or_none():
                    continue

                content = ContentItem(
                    org_id=org_id,
                    service_instance_id=service_id,
                    external_id=item["external_id"],
                    content_type=item["content_type"],
                    category=item["category"],
                    payload=item["payload"],
                    content_hash=content_hash,
                )
                db.add(content)
                items_fetched += 1

        from datetime import datetime, timezone
        service.last_synced_at = datetime.now(timezone.utc)
        await db.commit()
        return {"status": "synced", "items_fetched": items_fetched}


@shared_task(name="tasks.analyze_content")
def analyze_content(content_id: str, org_id: str):
    return run_async(_analyze_content(content_id, org_id))


async def _analyze_content(content_id: str, org_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ContentItem).where(ContentItem.id == content_id)
        )
        content = result.scalar_one_or_none()
        if not content:
            return {"error": "Content not found"}

        text_to_analyze = ""
        payload = content.payload
        if isinstance(payload, dict):
            text_to_analyze = payload.get("snippet", {}).get("description", "")
            if not text_to_analyze:
                text_to_analyze = payload.get("text", "")
            if not text_to_analyze:
                text_to_analyze = payload.get("body", "")

        if not text_to_analyze:
            return {"status": "skipped", "reason": "no text content"}

        from app.ml.analyzer import analyze_text
        analysis = analyze_text(text_to_analyze)

        metadata = ContentMetadata(
            org_id=org_id,
            content_item_id=content_id,
            sentiment=analysis["sentiment"],
            sentiment_score=analysis["sentiment_score"],
            spam_score=analysis["spam_score"],
            language=analysis["language"],
            auto_tags=analysis["tags"],
            flagged=analysis["spam_score"] > 0.8,
            flag_reasons=["spam"] if analysis["spam_score"] > 0.8 else [],
        )
        db.add(metadata)
        await db.commit()
        return {"status": "analyzed", "sentiment": analysis["sentiment"]}
