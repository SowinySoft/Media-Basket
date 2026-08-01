"""Service management API — connect, list, and manage social media services."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ServiceInstance, Organization, Member, SyncJob
from app.schemas.schemas import ServiceCreate, ServiceResponse
from app.routes.auth import get_current_user
from app.core.logging import get_logger
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core.logging import get_logger


logger = get_logger("services")

router = APIRouter()


class SyncJobResponse(BaseModel):
    id: UUID
    service_instance_id: UUID
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[ServiceResponse])
async def list_services(
    org_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ServiceInstance)
        .where(ServiceInstance.org_id == org_id)
        .order_by(ServiceInstance.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("", response_model=ServiceResponse, status_code=201)
async def create_service(
    org_id: str,
    data: ServiceCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    existing = await db.execute(
        select(ServiceInstance).where(
            ServiceInstance.org_id == org_id,
            ServiceInstance.connector_type == data.connector_type,
        )
    )
    existing_service = existing.scalar_one_or_none()
    if existing_service:
        return existing_service

    service = ServiceInstance(
        org_id=org_id,
        created_by=current_user["member_id"],
        connector_type=data.connector_type,
        display_name=data.display_name,
    )
    db.add(service)
    await db.flush()
    await db.refresh(service)
    return service


@router.post("/{service_id}/sync")
async def trigger_sync(
    org_id: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ServiceInstance).where(
            ServiceInstance.id == service_id,
            ServiceInstance.org_id == org_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Create sync job record
    sync_job = SyncJob(
        org_id=org_id,
        service_instance_id=service_id,
        status="pending",
    )
    db.add(sync_job)
    await db.commit()
    await db.refresh(sync_job)

    # Run sync inline. Celery may not have a worker running in this
    # environment (e.g. Railway), so we execute directly to guarantee
    # content is ingested and the job reaches a terminal state.
    from app.tasks import _sync_service
    from datetime import datetime, timezone

    sync_job.status = "running"
    sync_job.started_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        result = await _sync_service(str(service_id), str(org_id))
        sync_job.status = "completed"
        sync_job.result = result
        sync_job.completed_at = datetime.now(timezone.utc)
        if result.get("error"):
            sync_job.status = "failed"
            sync_job.error = result["error"]
        await db.commit()
        return {
            "status": "synced" if not result.get("error") else "failed",
            "service_id": str(service_id),
            "sync_job_id": str(sync_job.id),
            "result": result,
        }
    except Exception as e:
        sync_job.status = "failed"
        sync_job.error = str(e)
        sync_job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/{service_id}/sync-jobs", response_model=list[SyncJobResponse])
async def list_sync_jobs(
    org_id: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(SyncJob)
        .where(
            SyncJob.org_id == org_id,
            SyncJob.service_instance_id == service_id,
        )
        .order_by(SyncJob.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()


@router.delete("/{service_id}", status_code=204)
async def delete_service(
    org_id: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(
        select(ServiceInstance).where(
            ServiceInstance.id == service_id,
            ServiceInstance.org_id == org_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    await db.delete(service)
