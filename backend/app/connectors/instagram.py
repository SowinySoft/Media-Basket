import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com"
INSTAGRAM_TOKEN_EXCHANGE_URL = f"{INSTAGRAM_GRAPH_BASE}/access_token"
INSTAGRAM_TOKEN_REFRESH_URL = f"{INSTAGRAM_GRAPH_BASE}/refresh_access_token"


@dataclass
class InstagramManifest(ConnectorManifest):
    name: str = "instagram"
    display_name: str = "Instagram"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "instagram.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["posts", "comments", "profile"],
        "writes": ["comments"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": [
            "instagram_business_basic",
            "instagram_business_content_publish",
            "instagram_business_manage_comments",
        ],
        "auth_url": INSTAGRAM_AUTH_URL,
        "token_url": INSTAGRAM_TOKEN_URL,
    })


class InstagramConnector(ConnectorPlugin):
    manifest = InstagramManifest()

    def __init__(self):
        self.app_id = settings.INSTAGRAM_APP_ID if hasattr(settings, "INSTAGRAM_APP_ID") else ""
        self.app_secret = settings.INSTAGRAM_APP_SECRET if hasattr(settings, "INSTAGRAM_APP_SECRET") else ""
        self.redirect_uri = settings.INSTAGRAM_REDIRECT_URI if hasattr(settings, "INSTAGRAM_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/instagram"

    async def initialize(self, config: dict) -> None:
        self.app_id = config.get("app_id", self.app_id)
        self.app_secret = config.get("app_secret", self.app_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = ",".join(self.manifest.auth["scopes"])
        return (
            f"{INSTAGRAM_AUTH_URL}"
            f"?client_id={self.app_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&response_type=code"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(INSTAGRAM_TOKEN_URL, data={
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri,
                "code": code,
            })
            data = resp.json()
            if not data.get("access_token"):
                return data

            # Exchange short-lived token (1 hour) for long-lived (60 days)
            long_resp = await client.get(INSTAGRAM_TOKEN_EXCHANGE_URL, params={
                "grant_type": "ig_exchange_token",
                "client_secret": self.app_secret,
                "access_token": data["access_token"],
            })
            long_data = long_resp.json()
            if long_data.get("access_token"):
                data.update(long_data)
            if data.get("user_id") and not data.get("ig_user_id"):
                data["ig_user_id"] = data["user_id"]
            return data

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(INSTAGRAM_TOKEN_REFRESH_URL, params={
                "grant_type": "ig_refresh_token",
                "access_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INSTAGRAM_GRAPH_BASE}/{endpoint}",
                params={**(params or {}), "access_token": access_token},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "me", {"fields": "id,username,account_type,media_count"})
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "posts":
            ig_user_id = params.get("ig_user_id")
            data = await self._api_call(
                access_token,
                f"{ig_user_id}/media",
                {"fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", "limit": "50"},
            )
            return [
                {"external_id": p["id"], "content_type": "post", "category": "posts", "payload": p}
                for p in data.get("data", [])
            ]

        elif fetch_type == "comments":
            media_id = params.get("media_id")
            data = await self._api_call(
                access_token,
                f"{media_id}/comments",
                {"fields": "id,text,username,timestamp", "limit": "50"},
            )
            return [
                {"external_id": c["id"], "content_type": "comment", "category": "comments", "payload": c}
                for c in data.get("data", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete" and access_token:
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{INSTAGRAM_GRAPH_BASE}/{content_id}",
                    params={"access_token": access_token},
                )
                return resp.json()
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        if access_token:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{INSTAGRAM_GRAPH_BASE}/{content_id}/replies",
                    data={"message": message, "access_token": access_token},
                )

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
