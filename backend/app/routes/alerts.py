"""
Sentiment Alerts API
Alert when negative sentiment spikes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import Alert
from app.core.logging import get_logger


logger = get_logger("alerts")

router = APIRouter()


class AlertCreate(BaseModel):
    name: str
    type: str  # sentiment_drop, spike_negative, keyword_match, volume_spike
    config: dict  # { threshold: float, connector_types: list[str], keywords: list[str] }
    enabled: bool = True


class AlertUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None


@router.get("")
async def list_alerts(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Alert).where(Alert.org_id == org_id).order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "type": a.type,
            "config": a.config,
            "enabled": a.enabled,
            "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


@router.post("")
async def create_alert(
    alert: AlertCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    new_alert = Alert(
        org_id=org_id,
        name=alert.name,
        type=alert.type,
        config=alert.config,
        enabled=alert.enabled,
    )
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)
    return {"id": str(new_alert.id), "name": new_alert.name}


@router.put("/{alert_id}")
async def update_alert(
    alert_id: str,
    alert: AlertUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.name is not None:
        existing.name = alert.name
    if alert.config is not None:
        existing.config = alert.config
    if alert.enabled is not None:
        existing.enabled = alert.enabled

    await db.commit()
    return {"ok": True}


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}


@router.get("/check")
async def check_alerts(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Alert).where(Alert.org_id == org_id, Alert.enabled == True)
    )
    alerts = result.scalars().all()

    triggered = []
    for alert in alerts:
        # Simple alert check logic
        config = alert.config or {}
        if alert.type == "spike_negative":
            threshold = config.get("threshold", 0.7)
            # In production, this would query ContentMetadata for recent sentiment
            triggered.append({
                "alert_id": str(alert.id),
                "name": alert.name,
                "type": alert.type,
                "triggered": True,
                "message": f"Negative sentiment threshold ({threshold}) may be exceeded",
            })
        elif alert.type == "keyword_match":
            keywords = config.get("keywords", [])
            triggered.append({
                "alert_id": str(alert.id),
                "name": alert.name,
                "type": alert.type,
                "triggered": len(keywords) > 0,
                "message": f"Monitoring {len(keywords)} keywords",
            })

    return {"alerts": triggered, "total_checked": len(alerts)}
