from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token, blacklist_token
from app.core.config import get_settings
from app.models.models import User, Member, Organization, BillingPlan
from app.schemas.schemas import UserCreate, UserLogin, TokenResponse, UserResponse, OrganizationResponse

router = APIRouter()
security = HTTPBearer()
settings = get_settings()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


@router.post("/signup", response_model=TokenResponse)
async def signup(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        name=data.name,
        hashed_password=hash_password(data.password),
        auth_provider="email",
    )
    db.add(user)
    await db.flush()

    slug = data.name.lower().replace(" ", "-").replace("'", "")[:50]
    org = Organization(name=f"{data.name}'s Organization", slug=slug)
    db.add(org)
    await db.flush()

    member = Member(org_id=org.id, user_id=user.id, role="owner")
    db.add(member)
    await db.flush()

    billing = BillingPlan(org_id=org.id, plan="free", max_services=3, max_members=5)
    db.add(billing)

    token_data = {
        "sub": str(user.id),
        "org_id": str(org.id),
        "member_id": str(member.id),
        "role": "owner",
    }

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    member_result = await db.execute(
        select(Member).where(Member.user_id == user.id).limit(1)
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail="No organization found")

    token_data = {
        "sub": str(user.id),
        "org_id": str(member.org_id),
        "member_id": str(member.id),
        "role": member.role,
    }

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Logout by blacklisting the current access token."""
    blacklist_token(credentials.credentials)
    return {"detail": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Refresh an access token using a refresh token."""
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Blacklist the old refresh token
    blacklist_token(credentials.credentials)

    token_data = {
        "sub": payload["sub"],
        "org_id": payload["org_id"],
        "member_id": payload["member_id"],
        "role": payload["role"],
    }
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
