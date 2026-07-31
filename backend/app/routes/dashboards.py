"""
Custom Dashboards API
User-configurable dashboard widgets
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.routes.auth import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from sqlalchemy import select
from app.models.models import Dashboard

router = APIRouter()
logger = get_logger("dashboards")


class DashboardCreate(BaseModel):
    name: str
    config: dict  # { widgets: [{ type, position, size, config }] }
    is_default: bool = False


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict] = None
    is_default: Optional[bool] = None


@router.get("")
async def list_dashboards(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Dashboard).where(Dashboard.org_id == org_id).order_by(Dashboard.created_at.desc())
    )
    dashboards = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "config": d.config,
            "is_default": d.is_default,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in dashboards
    ]


@router.post("")
async def create_dashboard(
    dashboard: DashboardCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    if dashboard.is_default:
        # Unset other defaults
        result = await db.execute(
            select(Dashboard).where(Dashboard.org_id == org_id, Dashboard.is_default == True)
        )
        for d in result.scalars().all():
            d.is_default = False

    new_dashboard = Dashboard(
        org_id=org_id,
        name=dashboard.name,
        config=dashboard.config,
        is_default=dashboard.is_default,
    )
    db.add(new_dashboard)
    await db.commit()
    await db.refresh(new_dashboard)
    return {"id": str(new_dashboard.id), "name": new_dashboard.name}


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.org_id == org_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    return {
        "id": str(dashboard.id),
        "name": dashboard.name,
        "config": dashboard.config,
        "is_default": dashboard.is_default,
        "created_at": dashboard.created_at.isoformat() if dashboard.created_at else None,
        "updated_at": dashboard.updated_at.isoformat() if dashboard.updated_at else None,
    }


@router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    dashboard: DashboardUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if dashboard.name is not None:
        existing.name = dashboard.name
    if dashboard.config is not None:
        existing.config = dashboard.config
    if dashboard.is_default is not None:
        if dashboard.is_default:
            # Unset other defaults
            others = await db.execute(
                select(Dashboard).where(
                    Dashboard.org_id == org_id,
                    Dashboard.is_default == True,
                    Dashboard.id != dashboard_id,
                )
            )
            for d in others.scalars().all():
                d.is_default = False
        existing.is_default = dashboard.is_default

    await db.commit()
    return {"ok": True}


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}
