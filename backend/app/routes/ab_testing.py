"""
A/B Testing API
Test different content variations
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import ABTest
from app.core.logging import get_logger


logger = get_logger("ab_testing")

router = APIRouter()


class Variant(BaseModel):
    name: str
    content: str
    connector_type: Optional[str] = None


class ABTestCreate(BaseModel):
    name: str
    variants: List[Variant]


class ABTestUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None


@router.get("")
async def list_tests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    query = select(ABTest).where(ABTest.org_id == org_id).order_by(ABTest.created_at.desc())
    if status:
        query = query.where(ABTest.status == status)

    result = await db.execute(query)
    tests = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "variants": t.variants,
            "status": t.status,
            "winner_id": str(t.winner_id) if t.winner_id else None,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "ended_at": t.ended_at.isoformat() if t.ended_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tests
    ]


@router.post("")
async def create_test(
    test: ABTestCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    new_test = ABTest(
        org_id=org_id,
        name=test.name,
        variants=[v.model_dump() for v in test.variants],
        status="draft",
    )
    db.add(new_test)
    await db.commit()
    await db.refresh(new_test)
    return {"id": str(new_test.id), "name": new_test.name}


@router.put("/{test_id}")
async def update_test(
    test_id: str,
    test: ABTestUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id, ABTest.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Test not found")

    if test.name is not None:
        existing.name = test.name
    if test.status is not None:
        existing.status = test.status
        if test.status == "running":
            existing.started_at = datetime.utcnow()
        elif test.status in ("completed", "cancelled"):
            existing.ended_at = datetime.utcnow()

    await db.commit()
    return {"ok": True}


@router.post("/{test_id}/start")
async def start_test(
    test_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id, ABTest.org_id == org_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test.status != "draft":
        raise HTTPException(status_code=400, detail="Test is not in draft status")

    test.status = "running"
    test.started_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.post("/{test_id}/stop")
async def stop_test(
    test_id: str,
    winner_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id, ABTest.org_id == org_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test.status = "completed"
    test.ended_at = datetime.utcnow()
    if winner_id:
        test.winner_id = winner_id
    await db.commit()
    return {"ok": True}


@router.delete("/{test_id}")
async def delete_test(
    test_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id, ABTest.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Test not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}
