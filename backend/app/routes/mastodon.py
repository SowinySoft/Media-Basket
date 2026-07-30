from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

router = APIRouter()


@router.get("/{service_id}/mastodon/profile")
async def get_mastodon_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("mastodon")
    if not connector:
        raise HTTPException(status_code=404, detail="Mastodon connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/mastodon/statuses")
async def get_mastodon_statuses(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("mastodon")
    if not connector:
        raise HTTPException(status_code=404, detail="Mastodon connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "statuses",
        "account_id": credentials.get("account_id"),
    })
    statuses = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"statuses": statuses, "total": len(statuses)}


@router.get("/{service_id}/mastodon/notifications")
async def get_mastodon_notifications(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("mastodon")
    if not connector:
        raise HTTPException(status_code=404, detail="Mastodon connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "notifications",
    })
    notifications = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"notifications": notifications, "total": len(notifications)}


@router.post("/{service_id}/mastodon/status")
async def post_mastodon_status(
    service_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("mastodon")
    if not connector:
        raise HTTPException(status_code=404, detail="Mastodon connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(None, message, token=credentials.get("access_token", ""))
    return {"status": "posted"}


@router.post("/{service_id}/mastodon/status/{status_id}/favourite")
async def favourite_mastodon_status(
    service_id: str,
    status_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("mastodon")
    if not connector:
        raise HTTPException(status_code=404, detail="Mastodon connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    token = credentials.get("access_token", "")
    await connector._api_call(token, f"api/v1/statuses/{status_id}/favourite", method="POST")
    return {"status": "favourited"}
