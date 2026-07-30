import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

TELEGRAM_API_BASE = "https://api.telegram.org"


@dataclass
class TelegramManifest(ConnectorManifest):
    name: str = "telegram"
    display_name: str = "Telegram"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "telegram.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["messages", "chats", "media"],
        "writes": ["messages"],
        "webhooks": True,
        "poll_interval": "1m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "bot_token",
        "description": "Bot token from @BotFather",
    })


class TelegramConnector(ConnectorPlugin):
    manifest = TelegramManifest()

    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN if hasattr(settings, "TELEGRAM_BOT_TOKEN") else ""

    async def initialize(self, config: dict) -> None:
        self.bot_token = config.get("bot_token", self.bot_token)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        return f"https://t.me/{self.bot_token.split(':')[0]}" if self.bot_token else ""

    async def exchange_code(self, code: str) -> dict:
        return {"bot_token": code}

    async def refresh_token(self, refresh_token: str) -> dict:
        return {}

    async def _api_call(self, method: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TELEGRAM_API_BASE}/bot{self.bot_token}/{method}",
                params=params or {},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call("getMe")
            result = data.get("result", {})
            return [{"external_id": str(result.get("id")), "content_type": "bot", "category": "profile", "payload": result}]

        elif fetch_type == "chats":
            data = await self._api_call("getUpdates", {"limit": "100"})
            updates = data.get("result", [])
            chats = {}
            for u in updates:
                msg = u.get("message") or u.get("channel_post") or {}
                chat = msg.get("chat", {})
                if chat and chat.get("id") not in chats:
                    chats[chat["id"]] = chat
            return [
                {"external_id": str(cid), "content_type": "chat", "category": "chats", "payload": c}
                for cid, c in chats.items()
            ]

        elif fetch_type == "messages":
            chat_id = params.get("chat_id")
            data = await self._api_call("getUpdates", {"limit": "100"})
            updates = data.get("result", [])
            messages = []
            for u in updates:
                msg = u.get("message") or {}
                if msg.get("chat", {}).get("id") == int(chat_id) if chat_id else True:
                    messages.append({
                        "external_id": str(msg.get("message_id", "")),
                        "content_type": "message",
                        "category": "messages",
                        "payload": msg,
                    })
            return messages

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete":
            chat_id, message_id = content_id.split(":")
            await self._api_call("deleteMessage", {"chat_id": chat_id, "message_id": message_id})
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        await self._api_call("sendMessage", {"chat_id": content_id, "text": message})

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        data = json.loads(body)
        msg = data.get("message") or data.get("channel_post") or {}
        return {
            "type": "message",
            "chat_id": str(msg.get("chat", {}).get("id", "")),
            "message_id": str(msg.get("message_id", "")),
            "from": msg.get("from", {}).get("username", ""),
            "text": msg.get("text", ""),
            "timestamp": msg.get("date", 0),
        }
