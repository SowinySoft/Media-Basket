from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import Organization, Member, User, BillingPlan, ServiceInstance, CredentialVault, ContentItem
from app.schemas.schemas import OrganizationResponse
from app.routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.core.logging import get_logger


logger = get_logger("org")

router = APIRouter()


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    settings: Optional[dict] = None


class OrgCreate(BaseModel):
    name: str


@router.get("/me", response_model=OrganizationResponse)
async def get_org(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).where(Organization.id == current_user["org_id"])
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.put("/me", response_model=OrganizationResponse)
async def update_org(
    data: OrgUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update organization")

    result = await db.execute(
        select(Organization).where(Organization.id == current_user["org_id"])
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if data.name is not None:
        org.name = data.name
    if data.settings is not None:
        org.settings = {**org.settings, **data.settings}

    await db.commit()
    await db.refresh(org)
    return org


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owners can delete the organization")

    org_id = current_user["org_id"]

    # Delete all content items for this org
    content_result = await db.execute(
        select(ContentItem).where(ContentItem.org_id == org_id)
    )
    for item in content_result.scalars().all():
        await db.delete(item)

    # Delete all credential vault entries for this org
    cred_result = await db.execute(
        select(CredentialVault).where(CredentialVault.org_id == org_id)
    )
    for cred in cred_result.scalars().all():
        await db.delete(cred)

    # Delete all service instances for this org
    svc_result = await db.execute(
        select(ServiceInstance).where(ServiceInstance.org_id == org_id)
    )
    for svc in svc_result.scalars().all():
        await db.delete(svc)

    # Delete all members for this org
    member_result = await db.execute(
        select(Member).where(Member.org_id == org_id)
    )
    for member in member_result.scalars().all():
        await db.delete(member)

    # Delete billing plan
    billing_result = await db.execute(
        select(BillingPlan).where(BillingPlan.org_id == org_id)
    )
    billing = billing_result.scalar_one_or_none()
    if billing:
        await db.delete(billing)

    # Delete the org itself
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = org_result.scalar_one_or_none()
    if org:
        await db.delete(org)

    await db.commit()


@router.get("/my-orgs")
async def list_my_orgs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Member, Organization)
        .join(Organization, Member.org_id == Organization.id)
        .where(Member.user_id == current_user["sub"])
    )
    rows = result.all()
    return [
        {
            "org_id": str(member.org_id),
            "org_name": org.name,
            "org_slug": org.slug,
            "role": member.role,
            "joined_at": member.joined_at.isoformat(),
        }
        for member, org in rows
    ]


@router.post("/create")
async def create_personal_org(
    data: OrgCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import re as _re
    slug = _re.sub(r"[^a-z0-9]+", "-", data.name.lower().strip()).strip("-")[:50]

    existing_slug = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    if existing_slug.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Organization slug already taken")

    settings = get_settings()
    org = Organization(name=data.name, slug=slug)
    db.add(org)
    await db.flush()

    member = Member(org_id=org.id, user_id=current_user["sub"], role="owner")
    db.add(member)
    await db.flush()

    billing = BillingPlan(
        org_id=org.id,
        plan="free",
        max_services=settings.MAX_SERVICES_FREE,
        max_members=settings.MAX_MEMBERS_FREE,
        max_ml_analyses=settings.MAX_ML_ANALYSES_FREE,
    )
    db.add(billing)
    await db.commit()
    await db.refresh(org)

    logger.info("org_created", org_id=str(org.id), user_id=current_user["sub"])
    return {"org_id": str(org.id), "name": org.name, "slug": org.slug}
