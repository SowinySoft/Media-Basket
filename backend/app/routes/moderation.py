from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ModerationAction, ContentItem
from app.schemas.schemas import ModerationCreate, ModerationResponse
from app.routes.auth import get_current_user
from app.core.logging import get_logger


logger = get_logger("moderation")

router = APIRouter()


@router.post("/{content_id}", response_model=ModerationResponse)
async def moderate_content(
    org_id: str,
    content_id: str,
    data: ModerationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content_result = await db.execute(
        select(ContentItem).where(
            ContentItem.id == content_id,
            ContentItem.org_id == org_id,
        )
    )
    content = content_result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    action = ModerationAction(
        org_id=org_id,
        service_instance_id=content.service_instance_id,
        member_id=current_user["member_id"],
        content_item_id=content_id,
        action=data.action,
        details=data.details,
    )
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


@router.get("", response_model=list[ModerationResponse])
async def list_moderation_actions(
    org_id: str,
    service_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ModerationAction).where(ModerationAction.org_id == org_id)
    if service_id:
        query = query.where(ModerationAction.service_instance_id == service_id)
    query = query.order_by(ModerationAction.performed_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
