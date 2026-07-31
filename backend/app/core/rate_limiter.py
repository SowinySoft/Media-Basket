"""Rate Limiting Middleware with per-connector tracking and Prometheus metrics."""
import time
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.core.logging import get_logger
from app.core.metrics import rate_limit_remaining, rate_limit_total

logger = get_logger("rate_limiter")

# Map path prefixes to connector types for per-connector tracking
_CONNECTOR_PATH_MAP = {
    "/api/v1/orgs/": None,  # will extract from path
}


def _extract_connector_type(path: str) -> str:
    """Extract connector type from URL path (e.g. /orgs/{id}/services/{id}/youtube/... → youtube)."""
    parts = path.strip("/").split("/")
    # Look for known connector names in path
    connector_names = {
        "youtube", "reddit", "whatsapp", "telegram", "instagram", "twitter",
        "facebook", "linkedin", "tiktok", "discord", "slack", "mastodon",
        "pinterest", "snapchat", "bluesky",
    }
    for part in parts:
        if part in connector_names:
            return part
    return "other"


class RateLimiter:
    """In-memory rate limiter using sliding window."""

    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._limits: dict[str, tuple[int, int]] = {}  # path -> (max_requests, window_seconds)

    def set_limit(self, path: str, max_requests: int, window_seconds: int = 60):
        self._limits[path] = (max_requests, window_seconds)

    def get_limit(self, path: str) -> Optional[tuple[int, int]]:
        if path in self._limits:
            return self._limits[path]
        for prefix, limit in self._limits.items():
            if path.startswith(prefix):
                return limit
        return (100, 60)

    def is_rate_limited(self, client_id: str, path: str) -> tuple[bool, int, float]:
        """Check rate limit. Returns (is_limited, remaining, retry_after_seconds)."""
        limit = self.get_limit(path)
        if not limit:
            return False, 100, 0

        max_requests, window = limit
        now = time.time()
        cutoff = now - window

        # Clean old entries
        self._requests[client_id] = [t for t in self._requests[client_id] if t > cutoff]

        current = len(self._requests[client_id])
        remaining = max(0, max_requests - current)

        if current >= max_requests:
            oldest = self._requests[client_id][0]
            retry_after = oldest + window - now
            return True, 0, max(0, retry_after)

        self._requests[client_id].append(now)
        return False, remaining - 1, 0


rate_limiter = RateLimiter()

# Default limits
rate_limiter.set_limit("/api/v1/auth", 10, 60)
rate_limiter.set_limit("/api/v1/orgs", 50, 60)
rate_limiter.set_limit("/api/v1/services/webhook", 200, 60)
rate_limiter.set_limit("/api/v1", 100, 60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Exempt health checks and metrics
        if path in ("/api/v1/health", "/metrics"):
            return await call_next(request)

        # Determine client ID
        client_id = "anonymous"
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            client_id = auth_header[7:20]
        elif request.headers.get("x-api-key"):
            client_id = request.headers["x-api-key"][:20]
        elif request.headers.get("x-forwarded-for"):
            client_id = request.headers["x-forwarded-for"].split(",")[0].strip()
        else:
            client_id = request.client.host if request.client else "unknown"

        is_limited, remaining, retry_after = rate_limiter.is_rate_limited(client_id, path)

        # Update Prometheus gauge
        rate_limit_remaining.labels(client_id=client_id[:16], path=path).set(remaining)

        # Per-connector rate limit tracking
        connector_type = _extract_connector_type(path)
        if connector_type != "other":
            rate_limit_remaining.labels(client_id=connector_type, path=f"/connector/{connector_type}").set(remaining)

        if is_limited:
            rate_limit_total.labels(client_id=client_id[:16], path=path).inc()
            if connector_type != "other":
                rate_limit_total.labels(client_id=connector_type, path=f"/connector/{connector_type}").inc()
            logger.warning("rate_limit_exceeded", client_id=client_id[:16], path=path)
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                headers={
                    "Retry-After": str(int(retry_after)),
                    "X-RateLimit-Limit": str(rate_limiter.get_limit(path)[0]),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
