import hashlib
import hmac
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from app.core.config import get_settings
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("whatsapp_webhook")

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
    return PlainTextResponse(status_code=403, content="Verification failed")


@router.post("/webhook/whatsapp")
async def receive_whatsapp_message(
    request: Request,
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
            return PlainTextResponse(status_code=403, content="Invalid signature")

    body = await request.json()
    
    connector = get_connector("whatsapp")
    if not connector:
        return {"status": "error"}

    # Parse the webhook payload
    parsed = connector.parse_webhook(raw_body)
    
    if parsed.get("type") == "message":
        from_number = parsed.get("from")
        message_text = parsed.get("text")
        message_id = parsed.get("message_id")
        timestamp = parsed.get("timestamp")

        logger.info("whatsapp_message_received", from_number=from_number, message_id=message_id)
        
        # TODO: Store message in database
        # TODO: Find service instance by phone_number_id
        # TODO: Notify connected clients via WebSocket
        
        return {"status": "ok"}
    
    elif parsed.get("type") == "status":
        logger.info("whatsapp_status_update", status=parsed.get("status"))
        return {"status": "ok"}
    
    return {"status": "ok"}
