from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.vault import read_secret, store_secret
from app.models.models import ServiceInstance, ContentItem
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

router = APIRouter()


@router.get("/{service_id}/whatsapp/conversation/{conversation_id}/messages")
async def get_conversation_messages(
    service_id: str,
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("whatsapp")
    if not connector:
        raise HTTPException(status_code=404, detail="WhatsApp connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    messages = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "messages",
        "conversation_id": conversation_id,
        "phone_number_id": credentials.get("phone_number_id"),
    })

    message_list = []
    for m in messages:
        payload = m["payload"]
        message_list.append({
            "id": m["external_id"],
            "from": payload.get("from", ""),
            "to": payload.get("to", ""),
            "body": payload.get("text", {}).get("body", ""),
            "type": payload.get("type", ""),
            "timestamp": payload.get("timestamp", ""),
            "status": payload.get("status", ""),
        })

    return {"messages": message_list, "total": len(message_list)}


@router.post("/{service_id}/whatsapp/message/{message_id}/action")
async def moderate_message(
    service_id: str,
    message_id: str,
    action: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("whatsapp")
    if not connector:
        raise HTTPException(status_code=404, detail="WhatsApp connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    result = await connector.moderate(
        action,
        message_id,
        access_token=credentials.get("access_token", ""),
        phone_number_id=credentials.get("phone_number_id"),
    )
    return result


@router.post("/{service_id}/whatsapp/conversation/{conversation_id}/reply")
async def reply_to_conversation(
    service_id: str,
    conversation_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("whatsapp")
    if not connector:
        raise HTTPException(status_code=404, detail="WhatsApp connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(
        conversation_id,
        message,
        access_token=credentials.get("access_token", ""),
        phone_number_id=credentials.get("phone_number_id"),
    )
    return {"status": "replied"}


@router.get("/{service_id}/whatsapp/contact/{conversation_id}")
async def get_contact_info(
    service_id: str,
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("whatsapp")
    if not connector:
        raise HTTPException(status_code=404, detail="WhatsApp connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "contact",
        "contact_id": conversation_id,
        "phone_number_id": credentials.get("phone_number_id"),
    })

    if not items:
        return {"contact": None}

    contact = items[0]["payload"]

    return {
        "contact": {
            "phone_number": contact.get("wa_id", conversation_id),
            "name": contact.get("profile", {}).get("name", ""),
            "avatar": contact.get("profile", {}).get("pic_url", ""),
            "last_seen": "",
        }
    }
