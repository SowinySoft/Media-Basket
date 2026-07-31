from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Member, User, Organization
from app.routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core.logging import get_logger


logger = get_logger("members")

router = APIRouter()


class MemberInvite(BaseModel):
    email: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str


class MemberResponseWithUser(BaseModel):
    id: UUID
    org_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("", response_model=list[MemberResponseWithUser])
async def list_members(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Member).where(Member.org_id == current_user["org_id"])
    )
    members = result.scalars().all()

    response = []
    for member in members:
        user_result = await db.execute(select(User).where(User.id == member.user_id))
        user = user_result.scalar_one_or_none()
        response.append(MemberResponseWithUser(
            id=member.id,
            org_id=member.org_id,
            user_id=member.user_id,
            role=member.role,
            joined_at=member.joined_at,
            user_email=user.email if user else None,
            user_name=user.name if user else None,
        ))
    return response


@router.post("", response_model=MemberResponseWithUser, status_code=status.HTTP_201_CREATED)
async def invite_member(
    data: MemberInvite,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    if data.role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, member, or viewer")

    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. They must sign up first.")

    # Check if already a member
    existing = await db.execute(
        select(Member).where(
            Member.org_id == current_user["org_id"],
            Member.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    member = Member(
        org_id=current_user["org_id"],
        user_id=user.id,
        role=data.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return MemberResponseWithUser(
        id=member.id,
        org_id=member.org_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user_email=user.email,
        user_name=user.name,
    )


@router.patch("/{member_id}/role", response_model=MemberResponseWithUser)
async def update_member_role(
    member_id: UUID,
    data: MemberRoleUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can change roles")

    if data.role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, member, or viewer")

    # Can't change your own role
    if str(member_id) == current_user["member_id"]:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(
        select(Member).where(
            Member.id == member_id,
            Member.org_id == current_user["org_id"],
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Can't change owner's role
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    member.role = data.role
    await db.commit()
    await db.refresh(member)

    user_result = await db.execute(select(User).where(User.id == member.user_id))
    user = user_result.scalar_one_or_none()

    return MemberResponseWithUser(
        id=member.id,
        org_id=member.org_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user_email=user.email if user else None,
        user_name=user.name if user else None,
    )


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    # Can't remove yourself
    if str(member_id) == current_user["member_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await db.execute(
        select(Member).where(
            Member.id == member_id,
            Member.org_id == current_user["org_id"],
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    await db.delete(member)
    await db.commit()
