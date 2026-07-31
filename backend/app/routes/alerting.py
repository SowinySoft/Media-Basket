"""Alerting rules — Gap 16: define and query alerting thresholds."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Alert
from app.routes.auth import get_current_user
from app.core.logging import get_logger
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, timezone

router = APIRouter()
logger = get_logger("alerting")


class AlertRuleCreate(BaseModel):
    name: str
    alert_type: str  # sentiment_drop, spam_spike, credential_expiry, engagement_drop
    threshold: float = 0.0
    connector_type: str | None = None
    enabled: bool = True
    config: dict = {}


class AlertRuleResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    alert_type: str
    threshold: float
    connector_type: str | None = None
    enabled: bool
    config: dict
    triggered: bool
    triggered_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


def _alert_to_response(alert: Alert) -> dict:
    """Map Alert model columns to response shape."""
    cfg = alert.config or {}
    return {
        "id": alert.id,
        "org_id": alert.org_id,
        "name": alert.name,
        "alert_type": alert.type,
        "threshold": cfg.get("threshold", 0.0),
        "connector_type": cfg.get("connector_type"),
        "enabled": alert.enabled,
        "config": cfg,
        "triggered": alert.last_triggered_at is not None,
        "triggered_at": alert.last_triggered_at,
        "created_at": alert.created_at,
    }


@router.get("/rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Alert).where(Alert.org_id == org_id).order_by(Alert.created_at.desc())
    )
    return [_alert_to_response(a) for a in result.scalars().all()]


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    org_id: str,
    data: AlertRuleCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    cfg = {**data.config, "threshold": data.threshold}
    if data.connector_type:
        cfg["connector_type"] = data.connector_type

    alert = Alert(
        org_id=org_id,
        name=data.name,
        type=data.alert_type,
        config=cfg,
        enabled=data.enabled,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return _alert_to_response(alert)


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    org_id: str,
    rule_id: str,
    data: AlertRuleCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Alert).where(Alert.id == rule_id, Alert.org_id == org_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    alert.name = data.name
    alert.type = data.alert_type
    alert.enabled = data.enabled
    cfg = {**alert.config, **data.config, "threshold": data.threshold}
    if data.connector_type:
        cfg["connector_type"] = data.connector_type
    alert.config = cfg
    await db.flush()
    return _alert_to_response(alert)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    org_id: str,
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Alert).where(Alert.id == rule_id, Alert.org_id == org_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    await db.delete(alert)


@router.post("/evaluate")
async def evaluate_alerts(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate all enabled alert rules and trigger notifications if thresholds breached."""
    from app.routes.websocket import notify_alert_triggered
    from app.routes.inbox import create_notification

    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Alert).where(Alert.org_id == org_id, Alert.enabled == True)
    )
    alerts = result.scalars().all()

    triggered_count = 0
    for alert in alerts:
        threshold = (alert.config or {}).get("threshold", 0.0)
        should_trigger = False

        if alert.type == "credential_expiry":
            from app.models.models import CredentialVault
            cv = await db.execute(
                select(CredentialVault).where(CredentialVault.org_id == org_id)
            )
            for cred in cv.scalars().all():
                if cred.rotated_at:
                    days_old = (datetime.now(timezone.utc) - cred.rotated_at).days
                    if days_old > threshold:
                        should_trigger = True
                        break

        was_triggered = alert.last_triggered_at is not None

        if should_trigger and not was_triggered:
            alert.last_triggered_at = datetime.now(timezone.utc)
            triggered_count += 1
            await notify_alert_triggered(org_id, str(alert.id), alert.type, alert.name)
            await create_notification(
                db, org_id, "alert.triggered", alert.name,
                body=f"Alert '{alert.name}' triggered ({alert.type})",
                metadata={"alert_id": str(alert.id), "alert_type": alert.type},
            )
        elif not should_trigger and was_triggered:
            alert.last_triggered_at = None

    await db.flush()
    return {"evaluated": len(alerts), "triggered": triggered_count}
