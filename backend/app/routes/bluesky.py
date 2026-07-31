from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("bluesky")

router = APIRouter()


@router.get("/{service_id}/bluesky/profile")
async def get_bluesky_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("bluesky")
    if not connector:
        raise HTTPException(status_code=404, detail="Bluesky connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "handle": credentials.get("handle", ""),
        "app_password": credentials.get("app_password", ""),
        "type": "me",
    })
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/bluesky/feed")
async def get_bluesky_feed(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("bluesky")
    if not connector:
        raise HTTPException(status_code=404, detail="Bluesky connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "handle": credentials.get("handle", ""),
        "app_password": credentials.get("app_password", ""),
        "type": "feed",
    })
    posts = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"posts": posts, "total": len(posts)}


@router.get("/{service_id}/bluesky/notifications")
async def get_bluesky_notifications(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("bluesky")
    if not connector:
        raise HTTPException(status_code=404, detail="Bluesky connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "handle": credentials.get("handle", ""),
        "app_password": credentials.get("app_password", ""),
        "type": "notifications",
    })
    notifications = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"notifications": notifications, "total": len(notifications)}


@router.post("/{service_id}/bluesky/post")
async def post_bluesky(
    service_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("bluesky")
    if not connector:
        raise HTTPException(status_code=404, detail="Bluesky connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    token = await connector._login(credentials.get("handle", ""), credentials.get("app_password", ""))
    await connector.respond(None, message, token=token, handle=credentials.get("handle", ""))
    return {"status": "posted"}
