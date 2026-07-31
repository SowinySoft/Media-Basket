"""
Internal Comments API
Team comments on content items
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import InternalComment, User

router = APIRouter()


class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    body: str


@router.get("/{content_item_id}/comments")
async def get_comments(
    content_item_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(InternalComment, User.name, User.email)
        .join(User, InternalComment.user_id == User.id)
        .where(
            InternalComment.org_id == org_id,
            InternalComment.content_item_id == content_item_id,
        )
        .order_by(InternalComment.created_at.asc())
    )
    rows = result.all()
    return [
        {
            "id": str(c.id),
            "body": c.body,
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "user_name": name,
            "user_email": email,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c, name, email in rows
    ]


@router.post("/{content_item_id}/comments")
async def create_comment(
    content_item_id: str,
    comment: CommentCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    user_id = current_user["user_id"]
    member_id = current_user.get("member_id")

    new_comment = InternalComment(
        org_id=org_id,
        content_item_id=content_item_id,
        user_id=user_id,
        body=comment.body,
        parent_id=comment.parent_id,
    )
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)

    return {
        "id": str(new_comment.id),
        "body": new_comment.body,
        "parent_id": str(new_comment.parent_id) if new_comment.parent_id else None,
        "created_at": new_comment.created_at.isoformat() if new_comment.created_at else None,
    }


@router.put("/{content_item_id}/comments/{comment_id}")
async def update_comment(
    content_item_id: str,
    comment_id: str,
    comment: CommentUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(InternalComment).where(
            InternalComment.id == comment_id,
            InternalComment.org_id == org_id,
        )
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing.body = comment.body
    await db.commit()
    return {"ok": True}


@router.delete("/{content_item_id}/comments/{comment_id}")
async def delete_comment(
    content_item_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(InternalComment).where(
            InternalComment.id == comment_id,
            InternalComment.org_id == org_id,
        )
    )
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found")

    await db.delete(existing)
    await db.commit()
    return {"ok": True}
