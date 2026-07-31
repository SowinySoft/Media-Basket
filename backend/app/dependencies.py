"""Shared FastAPI dependencies for auth, roles, and org access."""
from fastapi import Depends, HTTPException
from app.routes.auth import get_current_user
from app.schemas.schemas import CurrentUser


async def get_current_user_typed(current_user: dict = Depends(get_current_user)) -> CurrentUser:
    return CurrentUser(**current_user)


def require_role(*allowed_roles: str):
    """Dependency factory: require the user to have one of the specified roles."""
    async def _check(user: CurrentUser = Depends(get_current_user_typed)):
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Role '{user.role}' not in {allowed_roles}")
        return user
    return _check


async def get_current_org_id(user: CurrentUser = Depends(get_current_user_typed)) -> str:
    return user.org_id
