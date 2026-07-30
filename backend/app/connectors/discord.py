import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_API_BASE = "https://discord.com/api/v10"


@dataclass
class DiscordManifest(ConnectorManifest):
    name: str = "discord"
    display_name: str = "Discord"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "discord.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["messages", "channels", "guilds"],
        "writes": ["messages"],
        "webhooks": True,
        "poll_interval": "1m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["bot", "identify", "guilds"],
        "auth_url": DISCORD_AUTH_URL,
        "token_url": DISCORD_TOKEN_URL,
    })


class DiscordConnector(ConnectorPlugin):
    manifest = DiscordManifest()

    def __init__(self):
        self.client_id = settings.DISCORD_CLIENT_ID if hasattr(settings, "DISCORD_CLIENT_ID") else ""
        self.client_secret = settings.DISCORD_CLIENT_SECRET if hasattr(settings, "DISCORD_CLIENT_SECRET") else ""
        self.bot_token = settings.DISCORD_BOT_TOKEN if hasattr(settings, "DISCORD_BOT_TOKEN") else ""
        self.redirect_uri = settings.DISCORD_REDIRECT_URI if hasattr(settings, "DISCORD_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/discord"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)
        self.bot_token = config.get("bot_token", self.bot_token)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = "+".join(self.manifest.auth["scopes"])
        return (
            f"{DISCORD_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&scope={scopes}"
            f"&response_type=code"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(DISCORD_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(DISCORD_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bot {token}"}
            if method == "GET":
                resp = await client.get(
                    f"{DISCORD_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{DISCORD_API_BASE}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            elif method == "DELETE":
                resp = await client.delete(
                    f"{DISCORD_API_BASE}/{endpoint}",
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        token = params.get("bot_token") or params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "users/@me")
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "guilds":
            data = await self._api_call(token, "users/@me/guilds")
            return [
                {"external_id": g["id"], "content_type": "guild", "category": "guilds", "payload": g}
                for g in data if isinstance(data, list)
            ]

        elif fetch_type == "channels":
            guild_id = params.get("guild_id")
            data = await self._api_call(token, f"guilds/{guild_id}/channels")
            return [
                {"external_id": c["id"], "content_type": "channel", "category": "channels", "payload": c}
                for c in data if isinstance(data, list) and c.get("type") in [0, 5]
            ]

        elif fetch_type == "messages":
            channel_id = params.get("channel_id")
            data = await self._api_call(token, f"channels/{channel_id}/messages", {"limit": "100"})
            return [
                {"external_id": m["id"], "content_type": "message", "category": "messages", "payload": m}
                for m in data if isinstance(data, list)
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        if action == "delete" and token:
            channel_id, message_id = content_id.split(":")
            await self._api_call(token, f"channels/{channel_id}/messages/{message_id}", method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        if token:
            await self._api_call(token, f"channels/{content_id}/messages", json_data={"content": message}, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
