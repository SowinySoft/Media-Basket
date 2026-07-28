import hashlib
import httpx
from dataclasses import dataclass, field
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.config import get_settings

settings = get_settings()

YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


@dataclass
class YouTubeManifest(ConnectorManifest):
    name: str = "youtube"
    display_name: str = "YouTube"
    version: str = "1.0.0"
    tier: str = "full"
    icon: str = "youtube.svg"
    capabilities: dict = field(default_factory=lambda: {
        "reads": ["videos", "comments", "analytics"],
        "writes": ["comments"],
        "webhooks": True,
        "poll_interval": "5m",
    })
    auth: dict = field(default_factory=lambda: {
        "type": "oauth2",
        "scopes": ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.force-ssl"],
        "auth_url": YOUTUBE_AUTH_URL,
        "token_url": YOUTUBE_TOKEN_URL,
    })


class YouTubeConnector(ConnectorPlugin):
    manifest = YouTubeManifest()

    def __init__(self):
        self.client_id = settings.YOUTUBE_CLIENT_ID if hasattr(settings, "YOUTUBE_CLIENT_ID") else ""
        self.client_secret = settings.YOUTUBE_CLIENT_SECRET if hasattr(settings, "YOUTUBE_CLIENT_SECRET") else ""
        self.redirect_uri = settings.YOUTUBE_REDIRECT_URI if hasattr(settings, "YOUTUBE_REDIRECT_URI") else "http://localhost:3001/api/v1/services/youtube/callback"

    async def initialize(self, config: dict) -> None:
        self.client_id = config.get("client_id", self.client_id)
        self.client_secret = config.get("client_secret", self.client_secret)

    async def shutdown(self) -> None:
        pass

    def get_auth_url(self, state: str) -> str:
        scopes = "+".join(self.manifest.auth["scopes"])
        return (
            f"{YOUTUBE_AUTH_URL}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&access_type=offline"
            f"&prompt=consent"
            f"&state={state}"
        )

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(YOUTUBE_TOKEN_URL, data={
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
            })
            return resp.json()

    async def refresh_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(YOUTUBE_TOKEN_URL, data={
                "refresh_token": refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
            })
            return resp.json()

    async def _api_call(self, access_token: str, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{YOUTUBE_API_BASE}/{endpoint}",
                params={**(params or {}), "access_token": access_token},
            )
            return resp.json()

    async def fetch(self, params: dict) -> list[dict]:
        access_token = params.get("access_token")
        fetch_type = params.get("type", "channel")

        if fetch_type == "channel":
            data = await self._api_call(access_token, "channels", {"part": "snippet,statistics", "mine": "true"})
            items = data.get("items", [])
            return [{"external_id": i["id"], "content_type": "channel", "category": "channel", "payload": i} for i in items]

        elif fetch_type == "videos":
            channel_id = params.get("channel_id")
            search_data = await self._api_call(access_token, "search", {
                "part": "snippet", "channelId": channel_id, "order": "date", "maxResults": "50", "type": "video"
            })
            video_ids = [i["id"]["videoId"] for i in search_data.get("items", [])]
            if not video_ids:
                return []
            videos_data = await self._api_call(access_token, "videos", {
                "part": "snippet,statistics", "id": ",".join(video_ids)
            })
            return [
                {"external_id": v["id"], "content_type": "video", "category": "videos", "payload": v}
                for v in videos_data.get("items", [])
            ]

        elif fetch_type == "comments":
            video_id = params.get("video_id")
            data = await self._api_call(access_token, "commentThreads", {
                "part": "snippet", "videoId": video_id, "maxResults": "50", "order": "time"
            })
            return [
                {"external_id": i["id"], "content_type": "comment", "category": "comments", "payload": i}
                for i in data.get("items", [])
            ]

        return []

    async def moderate(self, action: str, content_id: str, access_token: str = None) -> dict:
        if not access_token:
            return {"error": "No access token"}

        async with httpx.AsyncClient() as client:
            if action == "delete":
                resp = await client.delete(
                    f"{YOUTUBE_API_BASE}/comments",
                    params={"id": content_id, "access_token": access_token},
                )
            elif action == "flag":
                resp = await client.post(
                    f"{YOUTUBE_API_BASE}/comments/setModerationStatus",
                    params={"id": content_id, "moderationStatus": "heldForReview", "access_token": access_token},
                )
            elif action == "approve":
                resp = await client.post(
                    f"{YOUTUBE_API_BASE}/comments/setModerationStatus",
                    params={"id": content_id, "moderationStatus": "published", "access_token": access_token},
                )
            else:
                return {"error": f"Unknown action: {action}"}
            return resp.json()

    async def respond(self, content_id: str, message: str, access_token: str = None) -> None:
        if not access_token:
            return
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{YOUTUBE_API_BASE}/comments?access_token={access_token}",
                json={"snippet": {"parentId": content_id, "textOriginal": message}},
            )

    def verify_webhook(self, signature: str, body: bytes) -> bool:
        return True  # YouTube Pub/Sub uses topic verification, not HMAC

    def parse_webhook(self, body: bytes) -> dict:
        text = body.decode("utf-8")
        if "<feed" in text:
            import re
            video_id_match = re.search(r"yt:videoId>([^<]+)", text)
            return {"type": "new_video", "video_id": video_id_match.group(1) if video_id_match else None}
        return {"type": "unknown"}
