import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"


@dataclass
class TikTokManifest(ConnectorManifest):
    name: str = "tiktok"
    display_name: str = "TikTok"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "tiktok.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["videos", "comments", "profile"],
        "writes": ["comments"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["user.info.basic", "video.list", "video.publish"],
        "auth_url": TIKTOK_AUTH_URL,
        "token_url": TIKTOK_TOKEN_URL,
    })


class TikTokConnector(ConnectorPlugin):
    manifest = TikTokManifest()

    def __init__(self):
        self.client_key = settings.TIKTOK_CLIENT_KEY if hasattr(settings, "TIKTOK_CLIENT_KEY") else ""
        self.client_secret = settings.TIKTOK_CLIENT_SECRET if hasattr(settings, "TIKTOK_CLIENT_SECRET") else ""
        self.redirect_uri = settings.TIKTOK_REDIRECT_URI if hasattr(settings, "TIKTOK_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/tiktok"

    async def initialize(self, config: dict) -> None:
        self.client_key = config.get("client_key", self.client_key)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = " ".join(self.manifest.auth["scopes"])
        return (
            f"{TIKTOK_AUTH_URL}"
            f"?client_key={self.client_key}"
            f"&scope={scopes}"
            f"&response_type=code"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TIKTOK_TOKEN_URL, data={
                "client_key": self.client_key,
                "client_secret": self.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TIKTOK_TOKEN_URL, data={
                "client_key": self.client_key,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None, method: str = "GET") -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}"}
            if method == "GET":
                resp = await client.get(
                    f"{TIKTOK_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{TIKTOK_API_BASE}/{endpoint}",
                    data=params or {},
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "user/info/", {"fields": "open_id,display_name,avatar_url"})
            user = data.get("data", {}).get("user", {})
            return [{"external_id": user.get("open_id"), "content_type": "profile", "category": "profile", "payload": user}]

        elif fetch_type == "videos":
            data = await self._api_call(access_token, "video/list/", {"fields": "id,title,create_time,like_count,comment_count,share_count"})
            videos = data.get("data", {}).get("list", [])
            return [
                {"external_id": v["id"], "content_type": "video", "category": "videos", "payload": v}
                for v in videos
            ]

        elif fetch_type == "comments":
            video_id = params.get("video_id")
            data = await self._api_call(access_token, f"video/comment/list/", {"video_id": video_id})
            comments = data.get("data", {}).get("comments", [])
            return [
                {"external_id": c["id"], "content_type": "comment", "category": "comments", "payload": c}
                for c in comments
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete" and access_token:
            await self._api_call(access_token, f"video/delete/", {"video_id": content_id}, method="POST")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        if access_token:
            await self._api_call(access_token, f"video/comment/publish/", {
                "video_id": content_id,
                "text": message,
            }, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
