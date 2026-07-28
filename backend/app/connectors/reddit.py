import httpx
import time
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/authorize"
REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"


@dataclass
class RedditManifest(ConnectorManifest):
    name: str = "reddit"
    display_name: str = "Reddit"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "reddit.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["posts", "comments", "mod_queue"],
        "writes": ["comments", "moderation"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["read", "submit", "moderate", "mysubreddits"],
        "auth_url": REDDIT_AUTH_URL,
        "token_url": REDDIT_TOKEN_URL,
    })


class RedditConnector(ConnectorPlugin):
    manifest = RedditManifest()

    def __init__(self):
        self.client_id = settings.REDDIT_CLIENT_ID if hasattr(settings, "REDDIT_CLIENT_ID") else ""
        self.client_secret = settings.REDDIT_CLIENT_SECRET if hasattr(settings, "REDDIT_CLIENT_SECRET") else ""
        self.redirect_uri = settings.REDDIT_REDIRECT_URI if hasattr(settings, "REDDIT_REDIRECT_URI") else "http://localhost:3001/api/v1/services/reddit/callback"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = "+".join(self.manifest.auth["scopes"])
        return (
            f"{REDDIT_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&state={state}"
            f"&duration=permanent"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                REDDIT_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                },
                auth=(self.client_id, self.client_secret),
            )
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                REDDIT_TOKEN_URL,
                data={
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                auth=(self.client_id, self.client_secret),
            )
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{REDDIT_API_BASE}{endpoint}",
                params=params,
                headers={"Authorization": f"Bearer {access_token}", "User-Agent": "MediaBasket/1.0"},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "/api/v1/me")
            return [{"external_id": data.get("id"), "content_type": "user", "category": "profile", "payload": data}]

        elif fetch_type == "posts":
            data = await self._api_call(access_token, "/user/me/submitted", {"limit": "50"})
            return [
                {"external_id": p["data"]["id"], "content_type": "post", "category": "posts", "payload": p["data"]}
                for p in data.get("data", {}).get("children", [])
            ]

        elif fetch_type == "comments":
            data = await self._api_call(access_token, "/user/me/comments", {"limit": "50"})
            return [
                {"external_id": c["data"]["id"], "content_type": "comment", "category": "comments", "payload": c["data"]}
                for c in data.get("data", {}).get("children", [])
            ]

        elif fetch_type == "mod_queue":
            subreddit = params.get("subreddit", "mod")
            data = await self._api_call(access_token, f"/r/{subreddit}/about/modqueue", {"limit": "50"})
            return [
                {"external_id": p["data"]["id"], "content_type": "post", "category": "mod_queue", "payload": p["data"]}
                for p in data.get("data", {}).get("children", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if not access_token:
            return {"error": "No access token"}

        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}", "User-Agent": "MediaBasket/1.0"}

            if action == "approve":
                resp = await client.post(f"{REDDIT_API_BASE}/api/approve", data={"id": content_id}, headers=headers)
            elif action == "remove":
                resp = await client.post(f"{REDDIT_API_BASE}/api/remove", data={"id": content_id}, headers=headers)
            elif action == "spam":
                resp = await client.post(f"{REDDIT_API_BASE}/api/remove", data={"id": content_id, "spam": "true"}, headers=headers)
            else:
                return {"error": f"Unknown action: {action}"}

            return {"status": "ok", "action": action, "content_id": content_id}

    async def respond(self, content_id: str, message: str, access_token: str = None) -> None:
        if not access_token:
            return
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{REDDIT_API_BASE}/api/comment",
                data={"parent": content_id, "text": message},
                headers={"Authorization": f"Bearer {access_token}", "User-Agent": "MediaBasket/1.0"},
            )

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True  # Reddit has no webhooks

    def parse_webhook(self, body: bytes) -> dict:
        return {"type": "unknown"}
