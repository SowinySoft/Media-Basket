from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import ServiceInstance, Organization, Member
from app.schemas.schemas import ServiceCreate, ServiceResponse
from app.routes.auth import get_current_user

router = APIRouter()


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
