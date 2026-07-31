"""
Competitor Monitoring API
Track competitor accounts
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import Competitor
from app.core.logging import get_logger


logger = get_logger("competitors")

router = APIRouter()


class CompetitorCreate(BaseModel):
    connector_type: str
    external_id: str
    display_name: str
    metadata: Optional[dict] = None


class CompetitorUpdate(BaseModel):
    display_name: Optional[str] = None
    metadata: Optional[dict] = None


@router.get("")
async def list_competitors(
    connector_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    query = select(Competitor).where(Competitor.org_id == org_id).order_by(Competitor.created_at.desc())
    if connector_type:
        query = query.where(Competitor.connector_type == connector_type)

    result = await db.execute(query)
    competitors = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "connector_type": c.connector_type,
            "external_id": c.external_id,
            "display_name": c.display_name,
            "competitor_metadata": c.competitor_metadata,
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in competitors
    ]


@router.post("")
async def add_competitor(
    competitor: CompetitorCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    new_competitor = Competitor(
        org_id=org_id,
        connector_type=competitor.connector_type,
        external_id=competitor.external_id,
        display_name=competitor.display_name,
        competitor_metadata=competitor.metadata,
    )
    db.add(new_competitor)
    await db.commit()
    await db.refresh(new_competitor)
    return {"id": str(new_competitor.id), "display_name": new_competitor.display_name}


@router.put("/{competitor_id}")
async def update_competitor(
    competitor_id: str,
    competitor: CompetitorUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Competitor not found")

    if competitor.display_name is not None:
        existing.display_name = competitor.display_name
    if competitor.metadata is not None:
        existing.competitor_metadata = competitor.metadata

    await db.commit()
    return {"ok": True}


@router.delete("/{competitor_id}")
async def remove_competitor(
    competitor_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Competitor not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}


@router.post("/{competitor_id}/sync")
async def sync_competitor(
    competitor_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.org_id == org_id)
    )
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")

    # Update last_synced_at
    competitor.last_synced_at = datetime.utcnow()
    await db.commit()

    return {"ok": True, "synced_at": competitor.last_synced_at.isoformat()}
