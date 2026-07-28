from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from app.core.security import decode_token


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        return response


async def set_tenant_context(db, org_id: str):
    await db.execute(text(f"SET LOCAL app.current_tenant = '{org_id}'"))
