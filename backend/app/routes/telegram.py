from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import get_settings
from app.core.vault import read_secret, store_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

settings = get_settings()
router = APIRouter()


@router.post("/{service_id}/telegram/send")
async def send_telegram_message(
    service_id: str,
    chat_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("telegram")
    if not connector:
        raise HTTPException(status_code=404, detail="Telegram connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.initialize({"bot_token": credentials.get("bot_token", "")})
    await connector.respond(chat_id, message)
    return {"status": "sent"}


@router.get("/{service_id}/telegram/chats")
async def get_telegram_chats(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("telegram")
    if not connector:
        raise HTTPException(status_code=404, detail="Telegram connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.initialize({"bot_token": credentials.get("bot_token", "")})
    items = await connector.fetch({"type": "chats"})
    return {"chats": [{"id": i["external_id"], "payload": i["payload"]} for i in items]}


@router.get("/{service_id}/telegram/chat/{chat_id}/messages")
async def get_telegram_messages(
    service_id: str,
    chat_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("telegram")
    if not connector:
        raise HTTPException(status_code=404, detail="Telegram connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.initialize({"bot_token": credentials.get("bot_token", "")})
    items = await connector.fetch({"type": "messages", "chat_id": chat_id})
    messages = []
    for m in items:
        p = m["payload"]
        messages.append({
            "id": m["external_id"],
            "from": p.get("from", {}).get("username", "unknown"),
            "text": p.get("text", ""),
            "timestamp": p.get("date", 0),
        })
    return {"messages": messages, "total": len(messages)}
