"""
Task Assignment API
Assign moderation tasks to team members
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import Task, Member, User, ContentItem
from app.core.logging import get_logger


logger = get_logger("tasks")

router = APIRouter()


class TaskCreate(BaseModel):
    content_item_id: str
    assigned_to: Optional[str] = None
    priority: str = "medium"
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    query = (
        select(Task, User.name, User.email, ContentItem.content_type, ContentItem.payload)
        .outerjoin(Member, Task.assigned_to == Member.id)
        .outerjoin(User, Member.user_id == User.id)
        .outerjoin(ContentItem, Task.content_item_id == ContentItem.id)
        .where(Task.org_id == org_id)
        .order_by(Task.created_at.desc())
    )
    if status:
        query = query.where(Task.status == status)
    if assigned_to:
        query = query.where(Task.assigned_to == assigned_to)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(t.id),
            "content_item_id": str(t.content_item_id),
            "content_type": ct,
            "content_preview": (payload or {}).get("title") or (payload or {}).get("text", "")[:80] if payload else "",
            "assigned_to": str(t.assigned_to) if t.assigned_to else None,
            "assignee_name": name,
            "assignee_email": email,
            "status": t.status,
            "priority": t.priority,
            "notes": t.notes,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        }
        for t, name, email, ct, payload in rows
    ]


@router.post("")
async def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    # Verify content exists
    result = await db.execute(
        select(ContentItem).where(
            ContentItem.id == task.content_item_id,
            ContentItem.org_id == org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Content item not found")

    new_task = Task(
        org_id=org_id,
        content_item_id=task.content_item_id,
        assigned_to=task.assigned_to,
        priority=task.priority,
        notes=task.notes,
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)

    return {
        "id": str(new_task.id),
        "status": new_task.status,
        "priority": new_task.priority,
    }


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    task: TaskUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status is not None:
        existing.status = task.status
        if task.status == "done":
            existing.completed_at = datetime.now(timezone.utc)
    if task.assigned_to is not None:
        existing.assigned_to = task.assigned_to
    if task.priority is not None:
        existing.priority = task.priority
    if task.notes is not None:
        existing.notes = task.notes

    await db.commit()
    return {"ok": True}


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.org_id == org_id)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}


@router.get("/members")
async def list_members(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Member, User.name, User.email)
        .join(User, Member.user_id == User.id)
        .where(Member.org_id == org_id)
    )
    rows = result.all()
    return [
        {"id": str(m.id), "name": name, "email": email, "role": m.role}
        for m, name, email in rows
    ]
