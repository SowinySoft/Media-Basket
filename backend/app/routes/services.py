from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ServiceInstance, Organization, Member, SyncJob
from app.schemas.schemas import ServiceCreate, ServiceResponse
from app.routes.auth import get_current_user
from app.tasks import sync_service_safe
from app.celery_app import celery_app
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
):
    if current_user["org_id"] != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ServiceInstance)
        .where(ServiceInstance.org_id == org_id)
        .order_by(ServiceInstance.created_at.desc())
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

    sync_service_safe(str(service_id), str(org_id))
    return {
        "status": "sync_queued",
        "service_id": str(service_id),
        "sync_job_id": str(sync_job.id),
        "celery_available": celery_app is not None,
    }


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
