import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


@dataclass
class LinkedInManifest(ConnectorManifest):
    name: str = "linkedin"
    display_name: str = "LinkedIn"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "linkedin.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["posts", "comments", "profile"],
        "writes": ["posts", "comments"],
        "webhooks": False,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["openid", "profile", "w_member_social"],
        "auth_url": LINKEDIN_AUTH_URL,
        "token_url": LINKEDIN_TOKEN_URL,
    })


class LinkedInConnector(ConnectorPlugin):
    manifest = LinkedInManifest()

    def __init__(self):
        self.client_id = settings.LINKEDIN_CLIENT_ID if hasattr(settings, "LINKEDIN_CLIENT_ID") else ""
        self.client_secret = settings.LINKEDIN_CLIENT_SECRET if hasattr(settings, "LINKEDIN_CLIENT_SECRET") else ""
        self.redirect_uri = settings.LINKEDIN_REDIRECT_URI if hasattr(settings, "LINKEDIN_REDIRECT_URI") else "http://localhost:8000/api/v1/services/callback/linkedin"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = " ".join(self.manifest.auth["scopes"])
        return (
            f"{LINKEDIN_AUTH_URL}"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scopes}"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(LINKEDIN_TOKEN_URL, data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(LINKEDIN_TOKEN_URL, data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None, method: str = "GET", json_data: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
            if method == "GET":
                resp = await client.get(
                    f"{LINKEDIN_API_BASE}/{endpoint}",
                    params=params or {},
                    headers=headers,
                )
            elif method == "POST":
                resp = await client.post(
                    f"{LINKEDIN_API_BASE}/{endpoint}",
                    json=json_data or {},
                    headers=headers,
                )
            else:
                return {}
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "me")

        if fetch_type == "me":
            data = await self._api_call(access_token, "userinfo")
            return [{"external_id": data.get("sub"), "content_type": "profile", "category": "profile", "payload": data}]

        elif fetch_type == "posts":
            person_id = params.get("person_id")
            data = await self._api_call(access_token, f"ugcPosts", {
                "q": "authors",
                "authors": f"List(urn:li:person:{person_id})",
                "sortBy": "LAST_MODIFIED",
                "count": "50",
            })
            return [
                {"external_id": p.get("id", ""), "content_type": "post", "category": "posts", "payload": p}
                for p in data.get("elements", [])
            ]

        elif fetch_type == "comments":
            post_urn = params.get("post_urn")
            data = await self._api_call(access_token, f"socialActions/{post_urn}/comments", {"count": "50"})
            return [
                {"external_id": c.get("id", ""), "content_type": "comment", "category": "comments", "payload": c}
                for c in data.get("elements", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if action == "delete" and access_token:
            await self._api_call(access_token, f"ugcPosts/{content_id}", method="DELETE")
            return {"status": "deleted"}
        return {"error": f"Unknown action: {action}"}

    async def respond(self, content_id: str, message: str, access_token: str = None, **kwargs) -> None:
        if access_token:
            await self._api_call(access_token, f"socialActions/{content_id}/comments", json_data={"message": message}, method="POST")

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True

    def parse_webhook(self, body: bytes) -> dict:
        import json
        return json.loads(body)
