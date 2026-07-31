"""
Webhook Builder API
Visual webhook configuration
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import hashlib
import hmac
import json
from datetime import datetime, timezone
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import Webhook
from app.core.logging import get_logger


logger = get_logger("webhooks_builder")

router = APIRouter()


class WebhookCreate(BaseModel):
    url: str
    events: List[str]  # content.created, content.flagged, alert.triggered, etc.
    secret: Optional[str] = None
    enabled: bool = True


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    enabled: Optional[bool] = None


EVENT_TYPES = [
    "content.created",
    "content.flagged",
    "content.approved",
    "content.deleted",
    "alert.triggered",
    "sync.completed",
    "member.joined",
]


@router.get("/events")
async def list_event_types():
    return EVENT_TYPES


@router.get("")
async def list_webhooks(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Webhook).where(Webhook.org_id == org_id).order_by(Webhook.created_at.desc())
    )
    webhooks = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "url": w.url,
            "events": w.events,
            "enabled": w.enabled,
            "has_secret": w.secret is not None,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in webhooks
    ]


@router.post("")
async def create_webhook(
    webhook: WebhookCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    new_webhook = Webhook(
        org_id=org_id,
        url=webhook.url,
        events=webhook.events,
        secret=webhook.secret,
        enabled=webhook.enabled,
    )
    db.add(new_webhook)
    await db.commit()
    await db.refresh(new_webhook)
    return {"id": str(new_webhook.id), "url": new_webhook.url}


@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    webhook: WebhookUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if webhook.url is not None:
        existing.url = webhook.url
    if webhook.events is not None:
        existing.events = webhook.events
    if webhook.secret is not None:
        existing.secret = webhook.secret
    if webhook.enabled is not None:
        existing.enabled = webhook.enabled

    await db.commit()
    return {"ok": True}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id, Webhook.org_id == org_id)
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    import httpx
    payload = {
        "event": "webhook.test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {"message": "This is a test webhook from MediaBasket"},
    }

    headers = {"Content-Type": "application/json"}
    if webhook.secret:
        sig = hmac.new(
            webhook.secret.encode(),
            json.dumps(payload).encode(),
            hashlib.sha256,
        ).hexdigest()
        headers["X-Webhook-Signature"] = sig

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook.url, json=payload, headers=headers)
            return {"ok": resp.status_code < 400, "status_code": resp.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}
