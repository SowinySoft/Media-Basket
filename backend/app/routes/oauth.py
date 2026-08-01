from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db_with_request
from app.core.vault import store_secret
from app.models.models import ServiceInstance
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger
from app.core.config import get_settings
import hmac
import hashlib

settings = get_settings()

logger = get_logger("oauth")
router = APIRouter()


def _sign_state(state: str) -> str:
    """Create an HMAC signature for the OAuth state parameter."""
    sig = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        state.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{state}.{sig}"


def _verify_state(signed_state: str) -> str | None:
    """Verify and extract the original state from a signed state. Returns None if invalid."""
    try:
        state, sig = signed_state.rsplit(".", 1)
        expected = hmac.new(
            settings.JWT_SECRET_KEY.encode(),
            state.encode(),
            hashlib.sha256,
        ).hexdigest()[:16]
        if hmac.compare_digest(sig, expected):
            return state
    except (ValueError, AttributeError):
        pass
    return None


@router.get("/auth/{connector_type}")
async def get_auth_url(
    connector_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    connector = get_connector(connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    raw_state = f"{current_user['org_id']}:{service_id}"
    state = _sign_state(raw_state)
    auth_url = connector.get_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/callback/{connector_type}")
async def oauth_callback(
    connector_type: str,
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db_with_request),
):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    raw_state = _verify_state(state)
    if not raw_state:
        raise HTTPException(status_code=400, detail="Invalid or tampered state parameter")

    parts = raw_state.split(":")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state format")

    org_id, service_id = parts

    connector = get_connector(connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    try:
        token_data = await connector.exchange_code(code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {str(e)}")

    await store_secret(db, org_id, service_id, token_data)

    await db.commit()

    frontend_url = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(url=f"{frontend_url}/tree?connected={connector_type}")


@router.post("/refresh/{connector_type}/{service_id}")
async def refresh_token(
    connector_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_request),
):
    if current_user["org_id"] != (await db.execute(
        select(ServiceInstance.org_id).where(ServiceInstance.id == service_id)
    )).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    connector = get_connector(connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    from app.core.vault import read_secret

    credentials = await read_secret(db, current_user["org_id"], service_id)
    if not credentials or "refresh_token" not in credentials:
        raise HTTPException(status_code=400, detail="No refresh token available")

    try:
        new_tokens = await connector.refresh_token(credentials["refresh_token"])
        await store_secret(db, current_user["org_id"], service_id, {**credentials, **new_tokens})
        return {"status": "refreshed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token refresh failed: {str(e)}")
