import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SLACK_API_BASE = "https://slack.com/api"


@dataclass
class SlackManifest(ConnectorManifest):
    name: str = "slack"
    display_name: str = "Slack"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "slack.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["messages", "channels", "users"],
        "writes": ["messages"],
        "webhooks": True,
        "poll_interval": "1m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["channels:history", "channels:read", "chat:write", "users:read"],
        "auth_url": SLACK_AUTH_URL,
        "token_url": SLACK_TOKEN_URL,
    })


class SlackConnector(ConnectorPlugin):
    manifest = SlackManifest()

    def __init__(self):
        self.client_id = settings.SLACK_CLIENT_ID if hasattr(settings, "SLACK_CLIENT_ID") else ""
        self.client_secret = settings.SLACK_CLIENT_SECRET if hasattr(settings, "SLACK_CLIENT_SECRET") else ""
        self.bot_token = settings.SLACK_BOT_TOKEN if hasattr(settings, "SLACK_BOT_TOKEN") else ""
        self.redirect_uri = settings.SLACK_REDIRECT_URI if hasattr(settings, "SLACK_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/slack"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)
        self.bot_token = config.get("bot_token", self.bot_token)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = ",".join(self.manifest.auth["scopes"])
        return (
            f"{SLACK_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&scope={scopes}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(SLACK_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        return {}

    async def _api_call(self, token: str, method: str, params: dict = None, json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            resp = await client.post(
                f"{SLACK_API_BASE}/{method}",
                json=json_data or {},
                params=params or {},
                headers=headers,
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        token = params.get("bot_token") or params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "auth.test")
            user = data.get("user", {})
            return [{"external_id": data.get("user_id"), "content_type": "profile", "category": "profile", "payload": {"name": user, "team": data.get("team")}}]

        elif fetch_type == "channels":
            data = await self._api_call(token, "conversations.list", {"types": "public_channel,private_channel"})
            channels = data.get("channels", [])
            return [
                {"external_id": c["id"], "content_type": "channel", "category": "channels", "payload": c}
                for c in channels
            ]

        elif fetch_type == "messages":
            channel_id = params.get("channel_id")
            data = await self._api_call(token, "conversations.history", {"channel": channel_id, "limit": "100"})
            messages = data.get("messages", [])
            return [
                {"external_id": m["ts"], "content_type": "message", "category": "messages", "payload": m}
                for m in messages if m.get("type") == "message"
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        if action == "delete" and token:
            channel_id, ts = content_id.split(":")
            await self._api_call(token, "chat.delete", {"channel": channel_id, "ts": ts})
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        if token:
            await self._api_call(token, "chat.postMessage", json_data={"channel": content_id, "text": message})

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
