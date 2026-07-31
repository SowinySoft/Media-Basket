"""Team member management — invite, manage roles, permissions."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import Member, User, Organization, Invitation
from app.routes.auth import get_current_user
from app.dependencies import require_role
from app.schemas.schemas import CurrentUser
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone
import secrets
from app.core.logging import get_logger


logger = get_logger("members")

router = APIRouter()


class MemberInvite(BaseModel):
    email: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str


class AcceptInvite(BaseModel):
    token: str


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
        select(Member)
        .options(selectinload(Member.user))
        .where(Member.org_id == current_user["org_id"])
    )
    members = result.scalars().unique().all()

    return [
        MemberResponseWithUser(
            id=member.id,
            org_id=member.org_id,
            user_id=member.user_id,
            role=member.role,
            joined_at=member.joined_at,
            user_email=member.user.email if member.user else None,
            user_name=member.user.name if member.user else None,
        )
        for member in members
    ]


@router.post("", response_model=MemberResponseWithUser, status_code=status.HTTP_201_CREATED)
async def invite_member(
    data: MemberInvite,
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
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
            Member.org_id == current_user.org_id,
            Member.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    member = Member(
        org_id=current_user.org_id,
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
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    if data.role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, member, or viewer")

    # Can't change your own role
    if str(member_id) == current_user.member_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(
        select(Member).where(
            Member.id == member_id,
            Member.org_id == current_user.org_id,
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
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    # Can't remove yourself
    if str(member_id) == current_user.member_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await db.execute(
        select(Member).where(
            Member.id == member_id,
            Member.org_id == current_user.org_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    await db.delete(member)
    await db.commit()


@router.post("/invite")
async def invite_member_via_email(
    data: MemberInvite,
    current_user: CurrentUser = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    if data.role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, member, or viewer")

    settings = get_settings()
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    invitation = Invitation(
        org_id=current_user.org_id,
        email=data.email,
        role=data.role,
        token=token,
        invited_by=current_user.sub,
        accepted=False,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()

    invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
    logger.info(
        "member_invited",
        org_id=str(current_user.org_id),
        email=data.email,
        role=data.role,
    )
    return {"invite_url": invite_url, "email": data.email, "role": data.role}


@router.post("/accept-invite")
async def accept_invite(
    data: AcceptInvite,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(Invitation.token == data.token)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.accepted:
        raise HTTPException(status_code=400, detail="Invitation already accepted")

    now = datetime.now(timezone.utc)
    if invitation.expires_at.tzinfo is None:
        expires_at = invitation.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = invitation.expires_at
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Invitation has expired")

    existing = await db.execute(
        select(Member).where(
            Member.org_id == invitation.org_id,
            Member.user_id == current_user["sub"],
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member of this organization")

    member = Member(
        org_id=invitation.org_id,
        user_id=current_user["sub"],
        role=invitation.role,
    )
    db.add(member)
    invitation.accepted = True
    await db.commit()

    logger.info(
        "invite_accepted",
        org_id=str(invitation.org_id),
        user_id=current_user["sub"],
    )
    return {
        "detail": "Joined organization",
        "org_id": str(invitation.org_id),
        "role": invitation.role,
    }
