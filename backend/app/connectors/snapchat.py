import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

SNAPCHAT_AUTH_URL = "https://accounts.snap.com/auth/oauth2/authorize"
SNAPCHAT_TOKEN_URL = "https://accounts.snap.com/auth/oauth2/token"
SNAPCHAT_API_BASE = "https://adsapi.snapchat.com/v1"


@dataclass
class SnapchatManifest(ConnectorManifest):
    name: str = "snapchat"
    display_name: str = "Snapchat"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "snapchat.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["stories", "spotlight", "analytics"],
        "writes": ["stories"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["snapchat-story-api"],
        "auth_url": SNAPCHAT_AUTH_URL,
        "token_url": SNAPCHAT_TOKEN_URL,
    })


class SnapchatConnector(ConnectorPlugin):
    manifest = SnapchatManifest()

    def __init__(self):
        self.client_id = settings.SNAPCHAT_CLIENT_ID if hasattr(settings, "SNAPCHAT_CLIENT_ID") else ""
        self.client_secret = settings.SNAPCHAT_CLIENT_SECRET if hasattr(settings, "SNAPCHAT_CLIENT_SECRET") else ""
        self.redirect_uri = settings.SNAPCHAT_REDIRECT_URI if hasattr(settings, "SNAPCHAT_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/snapchat"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = " ".join(self.manifest.auth["scopes"])
        return (
            f"{SNAPCHAT_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(SNAPCHAT_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(SNAPCHAT_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            if method == "GET":
                resp = await client.get(
                    f"{SNAPCHAT_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{SNAPCHAT_API_BASE}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "me")
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "stories":
            data = await self._api_call(token, "me/stories")
            return [
                {"external_id": s["id"], "content_type": "story", "category": "stories", "payload": s}
                for s in data.get("data", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        if action == "delete" and token:
            await self._api_call(token, f"stories/{content_id}", method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        pass

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
