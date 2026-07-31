from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("slack")

router = APIRouter()


@router.get("/{service_id}/slack/profile")
async def get_slack_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("slack")
    if not connector:
        raise HTTPException(status_code=404, detail="Slack connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/slack/channels")
async def get_slack_channels(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("slack")
    if not connector:
        raise HTTPException(status_code=404, detail="Slack connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "channels"})
    channels = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"channels": channels, "total": len(channels)}


@router.get("/{service_id}/slack/channel/{channel_id}/messages")
async def get_slack_messages(
    service_id: str,
    channel_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("slack")
    if not connector:
        raise HTTPException(status_code=404, detail="Slack connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "messages", "channel_id": channel_id})
    messages = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"messages": messages, "total": len(messages)}


@router.post("/{service_id}/slack/channel/{channel_id}/send")
async def send_slack_message(
    service_id: str,
    channel_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("slack")
    if not connector:
        raise HTTPException(status_code=404, detail="Slack connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(channel_id, message, token=credentials.get("bot_token", ""))
    return {"status": "sent"}
