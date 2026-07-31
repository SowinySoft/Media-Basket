from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib
import hmac
from app.core.database import get_db
from app.core.config import get_settings
from app.core.vault import read_secret, store_secret
from app.models.models import ServiceInstance, ContentItem
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("whatsapp")

settings = get_settings()
router = APIRouter()


def _verify_hmac_signature(body: bytes, signature_header: str, app_secret: str) -> bool:
    """Verify HMAC-SHA256 signature from Facebook/WhatsApp."""
    if not signature_header or not app_secret:
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.get("/webhook/whatsapp")
async def verify_whatsapp_webhook(
    request: Request,
    hub_mode: str = None,
    hub_verify_token: str = None,
    hub_challenge: str = None,
):
    """Webhook verification endpoint for WhatsApp.
    
    Facebook sends a GET request to verify the webhook URL.
    We must respond with the hub_challenge value if the verify token matches.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook/whatsapp")
async def receive_whatsapp_message(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Webhook endpoint for receiving WhatsApp messages.
    
    Facebook sends POST requests when messages are received.
    We verify the HMAC-SHA256 signature, store them in the database,
    and notify connected clients via WebSocket.
    """
    raw_body = await request.body()

    # Verify HMAC signature
    signature = request.headers.get("x-hub-signature-256", "")
    if settings.WHATSAPP_APP_SECRET:
        if not _verify_hmac_signature(raw_body, signature, settings.WHATSAPP_APP_SECRET):
            logger.warning("webhook_hmac_verification_failed")
            raise HTTPException(status_code=403, detail="Invalid signature")

    body = await request.json()
    
    connector = get_connector("whatsapp")
    if not connector:
        raise HTTPException(status_code=500, detail="WhatsApp connector not found")
    
    # Parse the webhook payload
    parsed = connector.parse_webhook(await request.body())
    
    if parsed.get("type") == "message":
        from_number = parsed.get("from")
        message_text = parsed.get("text")
        message_id = parsed.get("message_id")
        timestamp = parsed.get("timestamp")

        # Find the service instance for this phone number
        # In production, you'd look up which org/service owns the receiving number
        # For now, we log the message
        
        print(f"WhatsApp message received: {from_number}: {message_text}")
        
        # Store message in database (find appropriate service instance)
        # This is a simplified version - in production, map phone_number_id to service_instance
        
        # TODO: Find service instance by phone_number_id
        # TODO: Store message in ContentItem
        # TODO: Notify connected clients via WebSocket
        
        return {"status": "ok"}
    
    elif parsed.get("type") == "status":
        # Message status update (delivered, read, etc.)
        print(f"WhatsApp status update: {parsed.get('status')}")
        return {"status": "ok"}
    
    return {"status": "ok"}


@router.post("/{service_id}/whatsapp/conversation/{conversation_id}/messages")
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

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    # Fetch messages from database (stored via webhook)
    result = await db.execute(
        select(ContentItem).where(
            ContentItem.service_instance_id == service_id,
            ContentItem.content_type == "message",
        ).order_by(ContentItem.ingested_at.desc()).limit(50)
    )
    messages = result.scalars().all()

    message_list = []
    for m in messages:
        payload = m.payload or {}
        message_list.append({
            "id": m.external_id,
            "from": payload.get("from", ""),
            "to": payload.get("to", ""),
            "body": payload.get("text", {}).get("body", "") if payload.get("text") else "",
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

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    result = await connector.moderate(
        action,
        message_id,
        access_token=credentials.get("access_token", settings.WHATSAPP_ACCESS_TOKEN),
        phone_number_id=credentials.get("phone_number_id", settings.WHATSAPP_PHONE_NUMBER_ID),
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

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(
        conversation_id,
        message,
        access_token=credentials.get("access_token", settings.WHATSAPP_ACCESS_TOKEN),
        phone_number_id=credentials.get("phone_number_id", settings.WHATSAPP_PHONE_NUMBER_ID),
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

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    return {
        "contact": {
            "phone_number": conversation_id,
            "name": "",
            "avatar": "",
            "last_seen": "",
        }
    }
