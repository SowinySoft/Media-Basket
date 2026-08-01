"""Vault audit logging helpers for recording vault access events."""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import VaultAuditLog


async def log_vault_access(
    db: AsyncSession,
    org_id: UUID,
    service_id: UUID,
    action: str,
    user_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> VaultAuditLog:
    """Log a vault access event (read, write, rotate, revoke)."""
    entry = VaultAuditLog(
        org_id=org_id,
        user_id=user_id,
        service_id=service_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    await db.flush()
    return entry
