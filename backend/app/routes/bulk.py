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

    # Batch-fetch all valid items in one query
    result = await db.execute(
        select(ContentItem).where(
            ContentItem.id.in_(req.content_ids),
            ContentItem.org_id == org_id,
        )
    )
    items_by_id = {str(item.id): item for item in result.scalars().all()}

    not_found_ids = set(req.content_ids) - set(items_by_id.keys())
    results["errors"] += len(not_found_ids)

    # Batch-fetch metadata for flag action
    metadata_by_item_id = {}
    if req.action == "flag" and items_by_id:
        meta_result = await db.execute(
            select(ContentMetadata).where(
                ContentMetadata.content_item_id.in_(list(items_by_id.keys())),
            )
        )
        metadata_by_item_id = {str(m.content_item_id): m for m in meta_result.scalars().all()}

    for cid in req.content_ids:
        item = items_by_id.get(cid)
        if not item:
            continue

        try:
            if req.action == "flag":
                meta = metadata_by_item_id.get(cid)
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

    # Batch-fetch all valid items in one query
    result = await db.execute(
        select(ContentItem).where(
            ContentItem.id.in_(req.content_ids),
            ContentItem.org_id == org_id,
        )
    )
    found_ids = {str(item.id) for item in result.scalars().all()}

    results["queued"] = len(found_ids)
    results["errors"] = len(req.content_ids) - len(found_ids)

    return results
