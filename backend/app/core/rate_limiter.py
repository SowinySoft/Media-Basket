"""
Rate Limiting Middleware
Prevent API abuse and ensure fair usage
"""
import time
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class RateLimiter:
    """In-memory rate limiter using sliding window"""
    
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._limits: dict[str, tuple[int, int]] = {}  # path -> (max_requests, window_seconds)
    
    def set_limit(self, path: str, max_requests: int, window_seconds: int = 60):
        """Set rate limit for a path"""
        self._limits[path] = (max_requests, window_seconds)
    
    def get_limit(self, path: str) -> Optional[tuple[int, int]]:
        """Get rate limit for a path"""
        # Check exact match first
        if path in self._limits:
            return self._limits[path]
        
        # Check prefix match
        for pattern, limit in self._limits.items():
            if path.startswith(pattern):
                return limit
        
        return None
    
    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, dict]:
        """Check if request is rate limited"""
        now = time.time()
        cutoff = now - window_seconds
        
        # Clean old requests
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        
        # Check limit
        current_count = len(self._requests[key])
        is_limited = current_count >= max_requests
        
        # Add current request
        if not is_limited:
            self._requests[key].append(now)
        
        return is_limited, {
            "limit": max_requests,
            "remaining": max(0, max_requests - current_count),
            "reset": int(cutoff + window_seconds),
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware"""
    
    def __init__(self, app, limiter: RateLimiter = None):
        super().__init__(app)
        self.limiter = limiter or RateLimiter()
        self._setup_defaults()
    
    def _setup_defaults(self):
        """Setup default rate limits"""
        # Auth endpoints - stricter limits
        self.limiter.set_limit("/api/v1/auth", 10, 60)  # 10 requests per minute
        
        # General API endpoints
        self.limiter.set_limit("/api/v1", 100, 60)  # 100 requests per minute
        
        # Search and analytics - moderate limits
        self.limiter.set_limit("/api/v1/orgs", 50, 60)  # 50 requests per minute
        
        # Webhook endpoints - higher limits
        self.limiter.set_limit("/api/v1/services/webhook", 200, 60)  # 200 requests per minute
    
    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiter"""
        # Skip rate limiting for health checks
        if request.url.path.startswith("/api/v1/health"):
            return await call_next(request)
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Get rate limit for path
        limit = self.limiter.get_limit(request.url.path)
        if not limit:
            return await call_next(request)
        
        max_requests, window_seconds = limit
        
        # Check rate limit
        is_limited, info = self.limiter.is_rate_limited(
            f"{client_id}:{request.url.path}",
            max_requests,
            window_seconds
        )
        
        if is_limited:
            return Response(
                content='{"error": "Rate limit exceeded", "retry_after": ' + str(info["reset"] - int(time.time())) + '}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": str(info["remaining"]),
                    "X-RateLimit-Reset": str(info["reset"]),
                    "Retry-After": str(max(1, info["reset"] - int(time.time()))),
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset"])
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Use API key if present
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"apikey:{api_key}"
        
        # Use auth token if present
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[7:]
            return f"token:{token[:16]}..."
        
        # Fall back to IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0]}"
        
        return f"ip:{request.client.host}"


# Global rate limiter instance
rate_limiter = RateLimiter()
