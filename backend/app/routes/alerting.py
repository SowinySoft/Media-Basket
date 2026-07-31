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
from datetime import datetime

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
    return result.scalars().all()


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

    alert = Alert(
        org_id=org_id,
        name=data.name,
        alert_type=data.alert_type,
        threshold=data.threshold,
        connector_type=data.connector_type,
        enabled=data.enabled,
        config=data.config,
        triggered=False,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert)
    return alert


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
    alert.alert_type = data.alert_type
    alert.threshold = data.threshold
    alert.connector_type = data.connector_type
    alert.enabled = data.enabled
    alert.config = data.config
    await db.flush()
    return alert


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
        # Simple threshold-based evaluation (extend per alert_type)
        should_trigger = False
        if alert.alert_type == "credential_expiry":
            # Check credential expiry
            from app.models.models import CredentialVault
            cv = await db.execute(
                select(CredentialVault).where(CredentialVault.org_id == org_id)
            )
            for cred in cv.scalars().all():
                from datetime import datetime, timezone
                if cred.rotated_at:
                    days_old = (datetime.now(timezone.utc) - cred.rotated_at).days
                    if days_old > alert.threshold:
                        should_trigger = True
                        break

        if should_trigger and not alert.triggered:
            alert.triggered = True
            alert.triggered_at = datetime.now(timezone.utc)
            triggered_count += 1
            await notify_alert_triggered(org_id, str(alert.id), alert.alert_type, alert.name)
            await create_notification(
                db, org_id, "alert.triggered", alert.name,
                body=f"Alert '{alert.name}' triggered ({alert.alert_type})",
                metadata={"alert_id": str(alert.id), "alert_type": alert.alert_type},
            )
        elif not should_trigger and alert.triggered:
            alert.triggered = False
            alert.triggered_at = None

    await db.flush()
    return {"evaluated": len(alerts), "triggered": triggered_count}
