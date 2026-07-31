"""CSRF protection middleware + Security headers for Media Basket."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.core.config import get_settings
import secrets

settings = get_settings()

_CSRF_TOKEN_COOKIE = "csrf_token"
_CSRF_HEADER = "x-csrf-token"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
_EXEMPT_PATHS = {"/api/v1/auth/login", "/api/v1/auth/signup", "/metrics", "/docs", "/redoc", "/openapi.json"}


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie CSRF protection.

    For same-origin browser requests, a CSRF token is set as a cookie and
    must be echoed back in the x-csrf-token header on state-changing methods.
    API-only clients (Bearer token) are exempt — CSRF only targets browsers.
    """

    async def dispatch(self, request: Request, call_next):
        # Set CSRF token cookie on every response if not present
        if _CSRF_TOKEN_COOKIE not in request.cookies:
            token = secrets.token_hex(32)
            response = Response()
            response.set_cookie(
                key=_CSRF_TOKEN_COOKIE,
                value=token,
                httponly=False,  # JS must read it
                secure=not settings.DEBUG,
                samesite="lax",
                max_age=86400,
            )
            # Forward to actual response
            actual_response = await call_next(request)
            actual_response.set_cookie(
                key=_CSRF_TOKEN_COOKIE,
                value=token,
                httponly=False,
                secure=not settings.DEBUG,
                samesite="lax",
                max_age=86400,
            )
            return actual_response

        # Validate CSRF on state-changing methods (skip safe methods + exempt paths)
        if request.method not in _SAFE_METHODS and request.url.path not in _EXEMPT_PATHS:
            # Skip validation for API clients using Bearer auth (not browser cookies)
            auth_header = request.headers.get("authorization", "")
            has_cookie = _CSRF_TOKEN_COOKIE in request.cookies
            has_header = _CSRF_HEADER in request.headers

            # If the request has a cookie but no header, and is not Bearer-only, reject
            if has_cookie and not has_header and not auth_header.startswith("Bearer "):
                return Response(
                    content='{"detail":"CSRF token missing"}',
                    status_code=403,
                    media_type="application/json",
                )

            # If both cookie and header present, verify they match
            if has_cookie and has_header:
                cookie_val = request.cookies.get(_CSRF_TOKEN_COOKIE)
                header_val = request.headers.get(_CSRF_HEADER)
                if cookie_val != header_val:
                    return Response(
                        content='{"detail":"CSRF token mismatch"}',
                        status_code=403,
                        media_type="application/json",
                    )

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' http://localhost:8000 ws://localhost:8000; "
            "frame-ancestors 'none'"
        )
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response
