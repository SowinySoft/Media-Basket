"""
Bulk Operations API
Batch moderation, publishing, and deletion
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select, update
from app.models.models import ContentItem, ContentMetadata, ModerationAction, Member
from app.core.logging import get_logger


logger = get_logger("bulk")

router = APIRouter()


class BulkModerateRequest(BaseModel):
    content_ids: List[str]
    action: str  # approve | flag | delete
    details: dict | None = None


class BulkPublishRequest(BaseModel):
    content_ids: List[str]
    connector_type: str


@router.post("/moderate")
async def bulk_moderate(
    req: BulkModerateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    member_id = current_user.get("member_id")
    results = {"processed": 0, "errors": 0}

    for cid in req.content_ids:
        try:
            # Verify content belongs to org
            result = await db.execute(
                select(ContentItem).where(
                    ContentItem.id == cid,
                    ContentItem.org_id == org_id,
                )
            )
            item = result.scalar_one_or_none()
            if not item:
                results["errors"] += 1
                continue

            if req.action == "flag":
                # Upsert metadata
                meta_result = await db.execute(
                    select(ContentMetadata).where(
                        ContentMetadata.content_item_id == cid,
                    )
                )
                meta = meta_result.scalar_one_or_none()
                if meta:
                    meta.flagged = True
                    meta.flag_reasons = req.details.get("reasons", []) if req.details else []
                else:
                    meta = ContentMetadata(
                        org_id=org_id,
                        content_item_id=cid,
                        flagged=True,
                        flag_reasons=req.details.get("reasons", []) if req.details else [],
                    )
                    db.add(meta)

            elif req.action == "delete":
                await db.delete(item)

            # Log moderation action
            if member_id:
                action_log = ModerationAction(
                    org_id=org_id,
                    service_instance_id=item.service_instance_id,
                    member_id=member_id,
                    content_item_id=cid,
                    action=req.action,
                    details=req.details,
                )
                db.add(action_log)

            results["processed"] += 1
        except Exception:
            results["errors"] += 1

    await db.commit()
    return results


@router.post("/publish")
async def bulk_publish(
    req: BulkPublishRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    results = {"queued": 0, "errors": 0}

    for cid in req.content_ids:
        try:
            result = await db.execute(
                select(ContentItem).where(
                    ContentItem.id == cid,
                    ContentItem.org_id == org_id,
                )
            )
            item = result.scalar_one_or_none()
            if not item:
                results["errors"] += 1
                continue

            # Queue for publishing (in real app, this would be a Celery task)
            results["queued"] += 1
        except Exception:
            results["errors"] += 1

    return results
