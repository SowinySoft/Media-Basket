import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

MASTODON_API_BASE = "https://mastodon.social/api/v1"


@dataclass
class MastodonManifest(ConnectorManifest):
    name: str = "mastodon"
    display_name: str = "Mastodon"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "mastodon.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["statuses", "accounts", "notifications"],
        "writes": ["statuses", "favourites", "reblogs"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["read", "write", "follow"],
        "auth_url": "TODO",
        "token_url": "TODO",
    })


class MastodonConnector(ConnectorPlugin):
    manifest = MastodonManifest()

    def __init__(self):
        self.instance_url = settings.MASTODON_INSTANCE_URL if hasattr(settings, "MASTODON_INSTANCE_URL") else "https://mastodon.social"
        self.client_id = settings.MASTODON_CLIENT_ID if hasattr(settings, "MASTODON_CLIENT_ID") else ""
        self.client_secret = settings.MASTODON_CLIENT_SECRET if hasattr(settings, "MASTODON_CLIENT_SECRET") else ""
        self.access_token = settings.MASTODON_ACCESS_TOKEN if hasattr(settings, "MASTODON_ACCESS_TOKEN") else ""
        self.redirect_uri = settings.MASTODON_REDIRECT_URI if hasattr(settings, "MASTODON_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/mastodon"

    async def initialize(self, config: dict) -> None:
        self.instance_url = config.get("instance_url", self.instance_url)
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)
        self.access_token = config.get("access_token", self.access_token)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = " ".join(self.manifest.auth["scopes"])
        return (
            f"{self.instance_url}/oauth/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.instance_url}/oauth/token", data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
                "code": code,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        return {}

    async def _api_call(self, token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            if method == "GET":
                resp = await client.get(
                    f"{self.instance_url}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{self.instance_url}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        token = params.get("access_token") or self.access_token
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "api/v1/accounts/verify_credentials")
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "statuses":
            account_id = params.get("account_id")
            data = await self._api_call(token, f"api/v1/accounts/{account_id}/statuses", {"limit": "40"})
            return [
                {"external_id": s["id"], "content_type": "status", "category": "statuses", "payload": s}
                for s in data if isinstance(data, list)
            ]

        elif fetch_type == "notifications":
            data = await self._api_call(token, "api/v1/notifications", {"limit": "40"})
            return [
                {"external_id": n["id"], "content_type": "notification", "category": "notifications", "payload": n}
                for n in data if isinstance(data, list)
            ]

        elif fetch_type == "search":
            query = params.get("q", "")
            data = await self._api_call(token, "api/v2/search", {"q": query, "type": "statuses"})
            return [
                {"external_id": s["id"], "content_type": "status", "category": "search", "payload": s}
                for s in data.get("statuses", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        if action == "delete" and token:
            await self._api_call(token, f"api/v1/statuses/{content_id}", method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        if token:
            await self._api_call(token, "api/v1/statuses", json_data={
                "status": message,
                "in_reply_to_id": content_id,
            }, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
