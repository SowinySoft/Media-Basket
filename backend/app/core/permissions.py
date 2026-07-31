"""Service permissions dependency — Gap 4: per-service RBAC enforcement.

Usage in routes:
    @router.get("/{service_id}/content")
    async def get_content(
        service_id: str,
        perms: dict = Depends(require_service_permission("read")),
        ...
    ):
"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Member
from app.routes.auth import get_current_user


async def require_service_permission(
    required_level: str = "read",
):
    """Return a dependency that checks service_permissions for the current user.

    Levels: "read" < "write" < "admin"
    Falls back to org-level role if service_permissions is empty.
    """

    async def _check(
        request: Request,
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        # Owners and admins bypass per-service checks
        if current_user.get("role") in ("owner", "admin"):
            return current_user

        # Get the service_id from path params
        service_id = request.path_params.get("service_id")
        if not service_id:
            return current_user

        # Load member's service_permissions
        result = await db.execute(
            select(Member).where(
                Member.org_id == current_user["org_id"],
                Member.user_id == current_user["sub"],
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        # Check per-service permissions
        perms = member.service_permissions or {}
        service_perm = perms.get(service_id, perms.get("default", None))

        if service_perm is None:
            # No per-service permission — fall back to org role
            role_hierarchy = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}
            required_hierarchy = {"read": 0, "write": 1, "admin": 2}
            user_level = role_hierarchy.get(current_user.get("role", "viewer"), 0)
            required_level_num = required_hierarchy.get(required_level, 0)
            if user_level < required_level_num:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            return current_user

        # Check per-service permission level
        level_hierarchy = {"read": 0, "write": 1, "admin": 2}
        perm_level = level_hierarchy.get(service_perm, -1)
        required_level_num = level_hierarchy.get(required_level, 0)
        if perm_level < required_level_num:
            raise HTTPException(status_code=403, detail="Insufficient service permissions")

        return current_user

    return _check
