import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize"
TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
TWITTER_API_BASE = "https://api.twitter.com/2"


@dataclass
class TwitterManifest(ConnectorManifest):
    name: str = "twitter"
    display_name: str = "Twitter/X"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "twitter.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["tweets", "mentions", "timeline"],
        "writes": ["tweets", "replies"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["tweet.read", "tweet.write", "users.read", "follows.read", "offline.access"],
        "auth_url": TWITTER_AUTH_URL,
        "token_url": TWITTER_TOKEN_URL,
    })


class TwitterConnector(ConnectorPlugin):
    manifest = TwitterManifest()

    def __init__(self):
        self.client_id = settings.TWITTER_CLIENT_ID if hasattr(settings, "TWITTER_CLIENT_ID") else ""
        self.client_secret = settings.TWITTER_CLIENT_SECRET if hasattr(settings, "TWITTER_CLIENT_SECRET") else ""
        self.redirect_uri = settings.TWITTER_REDIRECT_URI if hasattr(settings, "TWITTER_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/twitter"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = " ".join(self.manifest.auth["scopes"])
        return (
            f"{TWITTER_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
            f"&code_challenge=challenge"
            f"&code_challenge_method=s256"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                TWITTER_TOKEN_URL,
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "redirect_uri": self.redirect_uri,
                    "code_verifier": "challenge",
                },
                auth=(self.client_id, self.client_secret),
            )
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                TWITTER_TOKEN_URL,
                data={
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                },
                auth=(self.client_id, self.client_secret),
            )
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{TWITTER_API_BASE}/{endpoint}",
                params=params or {},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "users/me")
            user = data.get("data", {})
            return [{"external_id": user.get("id"), "content_type": "profile", "category": "profile", "payload": user}]

        elif fetch_type == "tweets":
            user_id = params.get("user_id")
            data = await self._api_call(access_token, f"users/{user_id}/tweets", {"max_results": "100"})
            return [
                {"external_id": t["id"], "content_type": "tweet", "category": "tweets", "payload": t}
                for t in data.get("data", [])
            ]

        elif fetch_type == "mentions":
            user_id = params.get("user_id")
            data = await self._api_call(access_token, f"users/{user_id}/mentions", {"max_results": "100"})
            return [
                {"external_id": t["id"], "content_type": "mention", "category": "mentions", "payload": t}
                for t in data.get("data", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete" and access_token:
            async with httpx.AsyncClient() as client:
                await client.delete(
                    f"{TWITTER_API_BASE}/tweets/{content_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        if access_token:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{TWITTER_API_BASE}/tweets",
                    json={"text": message, "reply": {"in_reply_to_tweet_id": content_id}},
                    headers={"Authorization": f"Bearer {access_token}"},
                )

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
