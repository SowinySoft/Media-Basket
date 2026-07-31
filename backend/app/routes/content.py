from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.models import ContentItem, ContentMetadata
from app.schemas.schemas import ContentResponse
from app.routes.auth import get_current_user
from app.core.logging import get_logger


logger = get_logger("content")

router = APIRouter()


@router.get("", response_model=list[ContentResponse])
async def list_content(
    service_id: str | None = None,
    content_type: str | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    query = (
        select(ContentItem)
        .options(selectinload(ContentItem.metadata_record))
        .where(ContentItem.org_id == org_id)
    )

    if service_id:
        query = query.where(ContentItem.service_instance_id == service_id)
    if content_type:
        query = query.where(ContentItem.content_type == content_type)
    if category:
        query = query.where(ContentItem.category == category)

    query = query.order_by(ContentItem.ingested_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().unique().all()

    response_items = []
    for item in items:
        item_dict = {
            "id": item.id,
            "service_instance_id": item.service_instance_id,
            "external_id": item.external_id,
            "content_type": item.content_type,
            "category": item.category,
            "payload": item.payload,
            "ingested_at": item.ingested_at,
            "metadata_record": None,
        }
        if item.metadata_record:
            item_dict["metadata_record"] = {
                "sentiment": item.metadata_record.sentiment,
                "sentiment_score": item.metadata_record.sentiment_score,
                "spam_score": item.metadata_record.spam_score,
                "toxicity_score": item.metadata_record.toxicity_score,
                "auto_tags": item.metadata_record.auto_tags,
                "language": item.metadata_record.language,
                "flagged": item.metadata_record.flagged,
                "flag_reasons": item.metadata_record.flag_reasons,
            }
        response_items.append(item_dict)

    return response_items
