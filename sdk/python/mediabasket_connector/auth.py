"""Auth helpers for common patterns."""
import httpx


class OAuth2Helper:
    """Helper for OAuth2 flows."""

    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, auth_url: str, token_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.auth_url = auth_url
        self.token_url = token_url

    def get_auth_url(self, scopes: list[str], state: str) -> str:
        scope_str = " ".join(scopes)
        return f"{self.auth_url}?client_id={self.client_id}&redirect_uri={self.redirect_uri}&scope={scope_str}&state={state}&response_type=code"

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(self.token_url, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(self.token_url, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })
            return resp.json()


class BotTokenHelper:
    """Helper for bot token authentication (Telegram, Discord bot)."""

    def __init__(self, token: str, api_base: str):
        self.token = token
        self.api_base = api_base

    async def verify(self) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.api_base}/getMe", params={"token": self.token})
            return resp.json()


class AppPasswordHelper:
    """Helper for app password auth (Bluesky)."""

    def __init__(self, service_url: str):
        self.service_url = service_url

    async def create_session(self, identifier: str, password: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.service_url}/com.atproto.server.createSession", json={
                "identifier": identifier,
                "password": password,
            })
            return resp.json()
