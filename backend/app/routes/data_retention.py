"""Data retention — Gap 20: automatic cleanup of old content/audit/activity."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select, text
from app.core.database import get_db
from app.models.models import ContentItem, AuditLog, ActivityLog, Notification, SyncJob
from app.core.metrics import data_retention_deleted_total
from app.core.logging import get_logger
from app.routes.auth import get_current_user

router = APIRouter()
logger = get_logger("data_retention")


@router.post("/cleanup")
async def run_cleanup(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    content_days: int = Query(365, ge=7, le=3650),
    audit_days: int = Query(365, ge=30, le=3650),
    activity_days: int = Query(90, ge=7, le=365),
    notification_days: int = Query(30, ge=1, le=365),
    dry_run: bool = Query(False),
):
    """Delete records older than the given thresholds. Supports dry_run."""
    if current_user["org_id"] != org_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] not in ("owner", "admin"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin role required")

    summary = {}

    # Content
    cutoff_content = text(f"NOW() - INTERVAL '{content_days} days'")
    q = delete(ContentItem).where(
        ContentItem.org_id == org_id,
        ContentItem.ingested_at < cutoff_content,
    )
    if dry_run:
        cnt = (await db.execute(
            select(func.count(ContentItem.id)).where(
                ContentItem.org_id == org_id,
                ContentItem.ingested_at < cutoff_content,
            )
        )).scalar() or 0
        summary["content"] = cnt
    else:
        result = await db.execute(q)
        summary["content"] = result.rowcount
        data_retention_deleted_total.labels(table_name="content_items").inc(result.rowcount)

    # Audit log
    cutoff_audit = text(f"NOW() - INTERVAL '{audit_days} days'")
    if dry_run:
        cnt = (await db.execute(
            select(func.count(AuditLog.id)).where(
                AuditLog.org_id == org_id,
                AuditLog.timestamp < cutoff_audit,
            )
        )).scalar() or 0
        summary["audit_log"] = cnt
    else:
        result = await db.execute(
            delete(AuditLog).where(AuditLog.org_id == org_id, AuditLog.timestamp < cutoff_audit)
        )
        summary["audit_log"] = result.rowcount
        data_retention_deleted_total.labels(table_name="audit_log").inc(result.rowcount)

    # Activity log
    cutoff_activity = text(f"NOW() - INTERVAL '{activity_days} days'")
    if dry_run:
        cnt = (await db.execute(
            select(func.count(ActivityLog.id)).where(
                ActivityLog.org_id == org_id,
                ActivityLog.created_at < cutoff_activity,
            )
        )).scalar() or 0
        summary["activity_log"] = cnt
    else:
        result = await db.execute(
            delete(ActivityLog).where(ActivityLog.org_id == org_id, ActivityLog.created_at < cutoff_activity)
        )
        summary["activity_log"] = result.rowcount

    # Notifications
    cutoff_notif = text(f"NOW() - INTERVAL '{notification_days} days'")
    if dry_run:
        cnt = (await db.execute(
            select(func.count(Notification.id)).where(
                Notification.org_id == org_id,
                Notification.created_at < cutoff_notif,
            )
        )).scalar() or 0
        summary["notifications"] = cnt
    else:
        result = await db.execute(
            delete(Notification).where(Notification.org_id == org_id, Notification.created_at < cutoff_notif)
        )
        summary["notifications"] = result.rowcount

    if not dry_run:
        await db.commit()

    logger.info("data_retention_run", org_id=org_id, dry_run=dry_run, summary=summary)
    return {"dry_run": dry_run, "summary": summary}
