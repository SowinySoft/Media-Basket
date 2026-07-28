import hashlib
import hmac
import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

WHATSAPP_AUTH_URL = "https://www.facebook.com/v18.0/dialog/oauth"
WHATSAPP_TOKEN_URL = "https://graph.facebook.com/v18.0/oauth/access_token"
WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0"


@dataclass
class WhatsAppManifest(ConnectorManifest):
    name: str = "whatsapp"
    display_name: str = "WhatsApp Business"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "whatsapp.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["conversations", "messages", "media"],
        "writes": ["messages", "templates"],
        "webhooks": True,
        "poll_interval": None,
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": [],
        "auth_url": WHATSAPP_AUTH_URL,
        "token_url": WHATSAPP_TOKEN_URL,
    })


class WhatsAppConnector(ConnectorPlugin):
    manifest = WhatsAppManifest()

    def __init__(self):
        self.app_id = settings.WHATSAPP_APP_ID if hasattr(settings, "WHATSAPP_APP_ID") else ""
        self.app_secret = settings.WHATSAPP_APP_SECRET if hasattr(settings, "WHATSAPP_APP_SECRET") else ""
        self.redirect_uri = settings.WHATSAPP_REDIRECT_URI if hasattr(settings, "WHATSAPP_REDIRECT_URI") else "http://localhost:3001/api/v1/services/whatsapp/callback"
        self.verify_token = settings.WHATSAPP_VERIFY_TOKEN if hasattr(settings, "WHATSAPP_VERIFY_TOKEN") else "media-basket-verify"

    async def initialize(self, config: dict) -> None:
        self.app_id = config.get("app_id", self.app_id)
        self.app_secret = config.get("app_secret", self.app_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        return (
            f"{WHATSAPP_AUTH_URL}"
            f"?client_id={self.app_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(WHATSAPP_TOKEN_URL, params={
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "redirect_uri": self.redirect_uri,
                "code": code,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{WHATSAPP_TOKEN_URL}", params={
                "grant_type": "fb_exchange_token",
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "fb_exchange_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{WHATSAPP_API_BASE}/{endpoint}",
                params={**(params or {}), "access_token": access_token},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        phone_number_id = params.get("phone_number_id")
        fetch_type = params.get("type", "conversations")

        if fetch_type == "conversations":
            data = await self._api_call(access_token, f"{phone_number_id}/conversations", {"limit": "50"})
            return [
                {"external_id": c["id"], "content_type": "conversation", "category": "conversations", "payload": c}
                for c in data.get("data", [])
            ]

        elif fetch_type == "messages":
            conversation_id = params.get("conversation_id")
            data = await self._api_call(access_token, f"{conversation_id}/messages", {"limit": "50"})
            return [
                {"external_id": m["id"], "content_type": "message", "category": "messages", "payload": m}
                for m in data.get("data", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        return {"error": "WhatsApp does not support moderation actions"}

    async def respond(self, content_id: str, message: str, access_token: str = None, phone_number_id: str = None) -> None:
        if not access_token or not phone_number_id:
            return
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{WHATSAPP_API_BASE}/{phone_number_id}/messages",
                json={
                    "messaging_product": "whatsapp",
                    "to": content_id,
                    "type": "text",
                    "text": {"body": message},
                },
                params={"access_token": access_token},
            )

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        if not signature:
            return False
        expected = hmac.new(
            self.app_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)

    def parse_webhook(self, body: bytes) -> dict:
        import json
        data = json.loads(body)
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        messages = value.get("messages", [])
        if messages:
            msg = messages[0]
            return {
                "type": "message",
                "from": msg.get("from"),
                "message_id": msg.get("id"),
                "text": msg.get("text", {}).get("body"),
                "timestamp": msg.get("timestamp"),
            }

        statuses = value.get("statuses", [])
        if statuses:
            return {"type": "status", "status": statuses[0].get("status")}

        return {"type": "unknown"}
