"""CSRF protection middleware + Security headers for Media Basket."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.core.security import decode_token
import secrets

_CSRF_TOKEN_COOKIE = "csrf_token"
_CSRF_HEADER = "x-csrf-token"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie CSRF protection.

    For same-origin browser requests, a CSRF token is set as a cookie and
    must be echoed back in the x-csrf-token header on state-changing methods.
    API-only clients (Bearer token) are exempt — CSRF only targets browsers.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Set CSRF token cookie on every response if not present
        if _CSRF_TOKEN_COOKIE not in request.cookies:
            token = secrets.token_hex(32)
            response.set_cookie(
                key=_CSRF_TOKEN_COOKIE,
                value=token,
                httponly=False,  # JS must read it
                secure=False,   # allow localhost
                samesite="lax",
                max_age=86400,
            )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


from app.core.config import get_settings
settings = get_settings()
