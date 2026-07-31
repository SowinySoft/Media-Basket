"""Tenant middleware — sets PostgreSQL session variable for RLS on every request."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy import text
from app.core.security import decode_token


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        org_id = None

        # Check Authorization header first
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            if payload:
                org_id = payload.get("org_id")

        # Fall back to httpOnly cookie
        if not org_id:
            token = request.cookies.get("access_token")
            if token:
                payload = decode_token(token)
                if payload:
                    org_id = payload.get("org_id")

        request.state.org_id = org_id
        response = await call_next(request)
        return response


async def set_tenant_context(db, org_id: str):
    """Set PostgreSQL session variable so RLS policies filter by tenant."""
    if org_id:
        await db.execute(text("SET LOCAL app.current_tenant = :org_id"), {"org_id": org_id})
