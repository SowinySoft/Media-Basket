from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.vault import store_secret
from app.models.models import ServiceInstance, CredentialVault
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("oauth")
router = APIRouter()


@router.get("/auth/{connector_type}")
async def get_auth_url(
    connector_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    connector = get_connector(connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    state = f"{current_user['org_id']}:{service_id}"
    auth_url = connector.get_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/callback/{connector_type}")
async def oauth_callback(
    connector_type: str,
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    parts = state.split(":")
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

    store_secret(db, org_id, service_id, token_data)

    existing = await db.execute(
        select(CredentialVault).where(CredentialVault.service_instance_id == service_id)
    )
    credential = existing.scalar_one_or_none()

    if credential:
        credential.vault_path = f"media_basket/{org_id}/{service_id}"
    else:
        credential = CredentialVault(
            org_id=org_id,
            service_instance_id=service_id,
            vault_path=f"media_basket/{org_id}/{service_id}",
        )
        db.add(credential)

    await db.commit()

    return RedirectResponse(url=f"http://localhost:3000/tree?connected={connector_type}")


@router.post("/refresh/{connector_type}/{service_id}")
async def refresh_token(
    connector_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
