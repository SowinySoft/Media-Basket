"""
Approval Workflow API
Content approval pipeline: draft -> pending -> approved -> published
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import ContentItem, ContentMetadata, ModerationAction, Member
from app.core.logging import get_logger


logger = get_logger("approval")

router = APIRouter()


class ApprovalAction(BaseModel):
    action: str  # approve | reject | request_changes
    notes: Optional[str] = None


@router.get("/{content_item_id}/approval")
async def get_approval_status(
    content_item_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    result = await db.execute(
        select(ContentItem, ContentMetadata)
        .outerjoin(ContentMetadata, ContentItem.id == ContentMetadata.content_item_id)
        .where(ContentItem.id == content_item_id, ContentItem.org_id == org_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Content not found")

    item, meta = row
    approval = (meta or {}).get("approval_status") if meta else None

    # Get approval history
    history_result = await db.execute(
        select(ModerationAction, Member.id, User.name)
        .outerjoin(Member, ModerationAction.member_id == Member.id)
        .outerjoin(User, Member.user_id == User.id)
        .where(
            ModerationAction.content_item_id == content_item_id,
            ModerationAction.org_id == org_id,
        )
        .order_by(ModerationAction.performed_at.desc())
    )
    history = [
        {
            "action": a.action,
            "details": a.details,
            "user_name": name or "System",
            "performed_at": a.performed_at.isoformat() if a.performed_at else None,
        }
        for a, _, name in history_result.all()
    ]

    return {
        "content_item_id": content_item_id,
        "approval_status": approval or "draft",
        "history": history,
    }


@router.post("/{content_item_id}/approval")
async def submit_for_approval(
    content_item_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    member_id = current_user.get("member_id")

    result = await db.execute(
        select(ContentItem, ContentMetadata)
        .outerjoin(ContentMetadata, ContentItem.id == ContentMetadata.content_item_id)
        .where(ContentItem.id == content_item_id, ContentItem.org_id == org_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Content not found")

    item, meta = row
    if meta:
        meta.approval_status = "pending"
    else:
        meta = ContentMetadata(
            org_id=org_id,
            content_item_id=content_item_id,
            approval_status="pending",
        )
        db.add(meta)

    # Log action
    action_log = ModerationAction(
        org_id=org_id,
        service_instance_id=item.service_instance_id,
        member_id=member_id,
        content_item_id=content_item_id,
        action="submit_for_approval",
        details={"status": "pending"},
    )
    db.add(action_log)
    await db.commit()

    return {"ok": True, "status": "pending"}


@router.post("/{content_item_id}/approval/action")
async def approval_action(
    content_item_id: str,
    req: ApprovalAction,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    member_id = current_user.get("member_id")

    result = await db.execute(
        select(ContentItem, ContentMetadata)
        .outerjoin(ContentMetadata, ContentItem.id == ContentMetadata.content_item_id)
        .where(ContentItem.id == content_item_id, ContentItem.org_id == org_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Content not found")

    item, meta = row
    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "request_changes": "changes_requested",
    }
    new_status = status_map.get(req.action, req.action)

    if meta:
        meta.approval_status = new_status
    else:
        meta = ContentMetadata(
            org_id=org_id,
            content_item_id=content_item_id,
            approval_status=new_status,
        )
        db.add(meta)

    # Log action
    action_log = ModerationAction(
        org_id=org_id,
        service_instance_id=item.service_instance_id,
        member_id=member_id,
        content_item_id=content_item_id,
        action=req.action,
        details={"status": new_status, "notes": req.notes},
    )
    db.add(action_log)
    await db.commit()

    return {"ok": True, "status": new_status}


@router.get("/pending")
async def list_pending_approvals(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(ContentItem, ContentMetadata)
        .join(ContentMetadata, ContentItem.id == ContentMetadata.content_item_id)
        .where(
            ContentItem.org_id == org_id,
            ContentMetadata.approval_status == "pending",
        )
        .order_by(ContentItem.ingested_at.desc())
    )
    rows = result.all()

    return [
        {
            "id": str(item.id),
            "content_type": item.content_type,
            "payload": item.payload,
            "ingested_at": item.ingested_at.isoformat() if item.ingested_at else None,
        }
        for item, _ in rows
    ]
