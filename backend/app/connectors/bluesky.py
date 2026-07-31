import httpx
from dataclasses import dataclass, field
from datetime import datetime, timezone
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

BLUESKY_API_BASE = "https://bsky.social/xrpc"


@dataclass
class BlueskyManifest(ConnectorManifest):
    name: str = "bluesky"
    display_name: str = "Bluesky"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "bluesky.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["posts", "feed", "notifications"],
        "writes": ["posts", "likes", "reposts"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "app_password",
        "description": "App password from Bluesky settings",
    })


class BlueskyConnector(ConnectorPlugin):
    manifest = BlueskyManifest()

    def __init__(self):
        self.handle = settings.BLUESKY_HANDLE if hasattr(settings, "BLUESKY_HANDLE") else ""
        self.app_password = settings.BLUESKY_APP_PASSWORD if hasattr(settings, "BLUESKY_APP_PASSWORD") else ""

    async def initialize(self, config: dict) -> None:
        self.handle = config.get("handle", self.handle)
        self.app_password = config.get("app_password", self.app_password)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        return "https://bsky.app/settings/app-passwords"

    async def exchange_code(self, code: str) -> dict:
        return {"handle": code.split(":")[0] if ":" in code else code, "app_password": code.split(":")[1] if ":" in code else ""}

    async def refresh_token(self, refresh_token: str) -> dict:
        return {}

    async def _login(self, handle: str, password: str) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{BLUESKY_API_BASE}/com.atproto.server.createSession", json={
                "identifier": handle,
                "password": password,
            })
            data = resp.json()
            return data.get("accessJwt", "")

    async def _api_call(self, token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            if method == "GET":
                resp = await client.get(
                    f"{BLUESKY_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{BLUESKY_API_BASE}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        handle = params.get("handle") or self.handle
        password = params.get("app_password") or self.app_password
        token = await self._login(handle, password)
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "app.bsky.actor.getProfile", {"actor": handle})
            return [{"external_id": data.get("did"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "feed":
            data = await self._api_call(token, "app.bsky.feed.getAuthorFeed", {"actor": handle, "limit": "50"})
            return [
                {"external_id": p["post"]["uri"], "content_type": "post", "category": "feed", "payload": p["post"]}
                for p in data.get("feed", [])
            ]

        elif fetch_type == "notifications":
            data = await self._api_call(token, "app.bsky.notification.listNotifications", {"limit": "50"})
            return [
                {"external_id": n["uri"], "content_type": "notification", "category": "notifications", "payload": n}
                for n in data.get("notifications", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        return {"error": "Bluesky does not support delete via API"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        if token:
            await self._api_call(token, "com.atproto.repo.createRecord", json_data={
                "repo": kwargs.get("handle", self.handle),
                "collection": "app.bsky.feed.post",
                "record": {
                    "$type": "app.bsky.feed.post",
                    "text": message,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "reply": {"root": {"uri": content_id, "cid": ""}, "parent": {"uri": content_id, "cid": ""}} if content_id else None,
                },
            }, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
