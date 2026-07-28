from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ContentItem
from app.schemas.schemas import ContentResponse
from app.routes.auth import get_current_user

router = APIRouter()


@router.get("", response_model=list[ContentResponse])
async def list_content(
    org_id: str,
    service_id: str | None = None,
    content_type: str | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ContentItem).where(ContentItem.org_id == org_id)

    if service_id:
        query = query.where(ContentItem.service_instance_id == service_id)
    if content_type:
        query = query.where(ContentItem.content_type == content_type)
    if category:
        query = query.where(ContentItem.category == category)

    query = query.order_by(ContentItem.ingested_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
