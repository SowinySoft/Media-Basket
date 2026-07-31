import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

PINTEREST_AUTH_URL = "https://www.pinterest.com/oauth/"
PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"
PINTEREST_API_BASE = "https://api.pinterest.com/v5"


@dataclass
class PinterestManifest(ConnectorManifest):
    name: str = "pinterest"
    display_name: str = "Pinterest"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "pinterest.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["pins", "boards", "analytics"],
        "writes": ["pins", "comments"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["boards:read", "boards:write", "pins:read", "pins:write"],
        "auth_url": PINTEREST_AUTH_URL,
        "token_url": PINTEREST_TOKEN_URL,
    })


class PinterestConnector(ConnectorPlugin):
    manifest = PinterestManifest()

    def __init__(self):
        self.app_id = settings.PINTEREST_APP_ID if hasattr(settings, "PINTEREST_APP_ID") else ""
        self.app_secret = settings.PINTEREST_APP_SECRET if hasattr(settings, "PINTEREST_APP_SECRET") else ""
        self.redirect_uri = settings.PINTEREST_REDIRECT_URI if hasattr(settings, "PINTEREST_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/pinterest"

    async def initialize(self, config: dict) -> None:
        self.app_id = config.get("app_id", self.app_id)
        self.app_secret = config.get("app_secret", self.app_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = ",".join(self.manifest.auth["scopes"])
        return (
            f"{PINTEREST_AUTH_URL}"
            f"?client_id={self.app_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
            f"&response_type=code"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(PINTEREST_TOKEN_URL, data={
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(PINTEREST_TOKEN_URL, data={
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })
            return resp.json()

    async def _api_call(self, token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            if method == "GET":
                resp = await client.get(
                    f"{PINTEREST_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{PINTEREST_API_BASE}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            elif method == "DELETE":
                resp = await client.delete(
                    f"{PINTEREST_API_BASE}/{endpoint}",
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(token, "user_account")
            return [{"external_id": data.get("id"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "boards":
            data = await self._api_call(token, "boards")
            return [
                {"external_id": b["id"], "content_type": "board", "category": "boards", "payload": b}
                for b in data.get("items", [])
            ]

        elif fetch_type == "pins":
            board_id = params.get("board_id")
            data = await self._api_call(token, f"boards/{board_id}/pins")
            return [
                {"external_id": p["id"], "content_type": "pin", "category": "pins", "payload": p}
                for p in data.get("items", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, token: str = None) -> dict:
        if action == "delete" and token:
            await self._api_call(token, f"pins/{content_id}", method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, token: str = None, **kwargs) -> None:
        """Pinterest API v5 doesn't support comments directly.
        We create a new pin referencing the original board as a 'save' action."""
        if token:
            board_id = kwargs.get("board_id", "me")
            await self._api_call(token, "pins", method="POST", json_data={
                "board_id": board_id,
                "title": f"Re: {content_id}",
                "description": message,
                "link": kwargs.get("link", ""),
            })

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
