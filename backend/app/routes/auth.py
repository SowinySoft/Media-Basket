"""Auth routes — supports both Bearer token and httpOnly cookie authentication."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, blacklist_token,
)
from app.core.config import get_settings
from app.models.models import User, Member, Organization, BillingPlan
from app.schemas.schemas import UserCreate, UserLogin, TokenResponse, UserResponse, OrganizationResponse
from app.core.logging import get_logger

router = APIRouter()
security = HTTPBearer(auto_error=False)
settings = get_settings()
logger = get_logger("auth")

_COOKIE_SECURE = not settings.DEBUG
_ACCESS_TOKEN_MAX_AGE = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_TOKEN_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400


def _extract_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """Extract JWT from Bearer header or httpOnly cookie."""
    if credentials and credentials.credentials:
        return credentials.credentials
    return request.cookies.get("access_token")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set JWT tokens as httpOnly cookies."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=_ACCESS_TOKEN_MAX_AGE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=_REFRESH_TOKEN_MAX_AGE,
    )


def _clear_auth_cookies(response: Response):
    """Clear JWT cookies on logout."""
    response.delete_cookie("access_token", httponly=True, secure=_COOKIE_SECURE, samesite="lax")
    response.delete_cookie("refresh_token", httponly=True, secure=_COOKIE_SECURE, samesite="lax")


@router.post("/signup", response_model=TokenResponse)
async def signup(data: UserCreate, response: Response, db: AsyncSession = Depends(get_db)):
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

    import re as _re
    slug = _re.sub(r"[^a-z0-9]+", "-", data.name.lower().strip()).strip("-")[:50]
    org = Organization(name=f"{data.name}'s Organization", slug=slug)
    db.add(org)
    await db.flush()

    member = Member(org_id=org.id, user_id=user.id, role="owner")
    db.add(member)
    await db.flush()

    from datetime import datetime, timedelta, timezone
    signup_date = user.created_at or datetime.now(timezone.utc)
    billing = BillingPlan(
        org_id=org.id,
        plan="free",
        max_services=3,
        max_members=5,
        current_period_end=signup_date + timedelta(days=90),
    )
    db.add(billing)

    token_data = {
        "sub": str(user.id),
        "org_id": str(org.id),
        "member_id": str(member.id),
        "role": "owner",
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("user_signup", user_id=str(user.id), org_id=str(org.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
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

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("user_login", user_id=str(user.id), org_id=str(member.org_id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


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
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Logout by blacklisting token and clearing cookies."""
    token = _extract_token(request, credentials)
    if token:
        blacklist_token(token)
    _clear_auth_cookies(response)
    logger.info("user_logout")
    return {"detail": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Refresh an access token using a refresh token (from cookie or header)."""
    token = _extract_token(request, credentials)
    # Also try the refresh_token cookie
    if not token:
        token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    blacklist_token(token)

    token_data = {
        "sub": payload["sub"],
        "org_id": payload["org_id"],
        "member_id": payload["member_id"],
        "role": payload["role"],
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
