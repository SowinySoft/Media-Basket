from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

router = APIRouter()


@router.get("/{service_id}/discord/profile")
async def get_discord_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("discord")
    if not connector:
        raise HTTPException(status_code=404, detail="Discord connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/discord/guilds")
async def get_discord_guilds(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("discord")
    if not connector:
        raise HTTPException(status_code=404, detail="Discord connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "guilds"})
    guilds = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"guilds": guilds, "total": len(guilds)}


@router.get("/{service_id}/discord/guild/{guild_id}/channels")
async def get_discord_channels(
    service_id: str,
    guild_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("discord")
    if not connector:
        raise HTTPException(status_code=404, detail="Discord connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "channels", "guild_id": guild_id})
    channels = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"channels": channels, "total": len(channels)}


@router.get("/{service_id}/discord/channel/{channel_id}/messages")
async def get_discord_messages(
    service_id: str,
    channel_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("discord")
    if not connector:
        raise HTTPException(status_code=404, detail="Discord connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"bot_token": credentials.get("bot_token", ""), "type": "messages", "channel_id": channel_id})
    messages = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"messages": messages, "total": len(messages)}


@router.post("/{service_id}/discord/channel/{channel_id}/send")
async def send_discord_message(
    service_id: str,
    channel_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("discord")
    if not connector:
        raise HTTPException(status_code=404, detail="Discord connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(channel_id, message, token=credentials.get("bot_token", ""))
    return {"status": "sent"}
