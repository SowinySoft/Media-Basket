import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

FACEBOOK_AUTH_URL = "https://www.facebook.com/v18.0/dialog/oauth"
FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v18.0/oauth/access_token"
FACEBOOK_API_BASE = "https://graph.facebook.com/v18.0"


@dataclass
class FacebookManifest(ConnectorManifest):
    name: str = "facebook"
    display_name: str = "Facebook"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "facebook.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["posts", "comments", "pages"],
        "writes": ["posts", "comments"],
        "webhooks": True,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_read_user_content"],
        "auth_url": FACEBOOK_AUTH_URL,
        "token_url": FACEBOOK_TOKEN_URL,
    })


class FacebookConnector(ConnectorPlugin):
    manifest = FacebookManifest()

    def __init__(self):
        self.app_id = settings.FACEBOOK_APP_ID if hasattr(settings, "FACEBOOK_APP_ID") else ""
        self.app_secret = settings.FACEBOOK_APP_SECRET if hasattr(settings, "FACEBOOK_APP_SECRET") else ""
        self.redirect_uri = settings.FACEBOOK_REDIRECT_URI if hasattr(settings, "FACEBOOK_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/facebook"

    async def initialize(self, config: dict) -> None:
        self.app_id = config.get("app_id", self.app_id)
        self.app_secret = config.get("app_secret", self.app_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = ",".join(self.manifest.auth["scopes"])
        return (
            f"{FACEBOOK_AUTH_URL}"
            f"?client_id={self.app_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(FACEBOOK_TOKEN_URL, params={
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "redirect_uri": self.redirect_uri,
                "code": code,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(FACEBOOK_TOKEN_URL, params={
                "grant_type": "fb_exchange_token",
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "fb_exchange_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None, method: str = "GET") -> dict:
        async with httpx.AsyncClient() as client:
            if method == "GET":
                resp = await client.get(
                    f"{FACEBOOK_API_BASE}/{endpoint}",
                    params={**(params or {}), "access_token": access_token},
                )
            elif method == "POST":
                resp = await client.post(
                    f"{FACEBOOK_API_BASE}/{endpoint}",
                    json={**(params or {}), "access_token": access_token},
                )
            elif method == "DELETE":
                resp = await client.delete(
                    f"{FACEBOOK_API_BASE}/{endpoint}",
                    params={"access_token": access_token},
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "me", {"fields": "id,name,email"})
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "pages":
            data = await self._api_call(access_token, "me/accounts", {"fields": "id,name,access_token"})
            return [
                {"external_id": p["id"], "content_type": "page", "category": "pages", "payload": p}
                for p in data.get("data", [])
            ]

        elif fetch_type == "posts":
            page_id = params.get("page_id")
            page_token = params.get("page_token") or access_token
            data = await self._api_call(page_token, f"{page_id}/posts", {"fields": "id,message,created_time,from", "limit": "50"})
            return [
                {"external_id": p["id"], "content_type": "post", "category": "posts", "payload": p}
                for p in data.get("data", [])
            ]

        elif fetch_type == "comments":
            post_id = params.get("post_id")
            data = await self._api_call(access_token, f"{post_id}/comments", {"fields": "id,message,from,created_time", "limit": "50"})
            return [
                {"external_id": c["id"], "content_type": "comment", "category": "comments", "payload": c}
                for c in data.get("data", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete" and access_token:
            await self._api_call(access_token, content_id, method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        if access_token:
            await self._api_call(access_token, f"{content_id}/comments", {"message": message}, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
