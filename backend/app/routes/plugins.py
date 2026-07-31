from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Plugin
from app.routes.auth import get_current_user
from app.core.plugin_loader import load_plugin_from_path, instantiate_plugin, unload_plugin
from app.core.plugin_validation import validate_plugin_manifest
from app.connectors.base import ConnectorPlugin
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.core.logging import get_logger


logger = get_logger("plugins")

router = APIRouter()


class PluginCreate(BaseModel):
    name: str
    display_name: str
    version: str = "1.0.0"
    tier: str = "lightweight"
    entry_point: str
    capabilities: dict = {}
    auth: dict = {}
    config: dict = {}


class PluginUpdate(BaseModel):
    display_name: Optional[str] = None
    version: Optional[str] = None
    tier: Optional[str] = None
    entry_point: Optional[str] = None
    capabilities: Optional[dict] = None
    auth: Optional[dict] = None
    config: Optional[dict] = None


class PluginResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    display_name: str
    version: str
    tier: str
    entry_point: str
    capabilities: dict
    auth: dict
    enabled: bool
    config: dict
    error: Optional[str] = None
    installed_at: datetime
    activated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("", response_model=list[PluginResponse])
async def list_plugins(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Plugin).where(Plugin.org_id == current_user["org_id"])
    )
    return result.scalars().all()


@router.post("", response_model=PluginResponse, status_code=status.HTTP_201_CREATED)
async def install_plugin(
    data: PluginCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can install plugins")

    # Validate manifest schema
    manifest_data = {
        "name": data.name,
        "display_name": data.display_name,
        "version": data.version,
        "tier": data.tier,
        "entry_point": data.entry_point,
        "capabilities": data.capabilities,
        "auth": data.auth,
    }
    is_valid, errors = validate_plugin_manifest(manifest_data)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid manifest: {'; '.join(errors)}")

    # Check for duplicate name in org
    existing = await db.execute(
        select(Plugin).where(
            Plugin.org_id == current_user["org_id"],
            Plugin.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Plugin with this name already exists")

    # Validate the plugin can be loaded
    connector_class = load_plugin_from_path(data.entry_point, data.name)
    error_msg = None
    if not connector_class:
        error_msg = f"Failed to load plugin from {data.entry_point}"

    plugin = Plugin(
        org_id=current_user["org_id"],
        name=data.name,
        display_name=data.display_name,
        version=data.version,
        tier=data.tier,
        entry_point=data.entry_point,
        capabilities=data.capabilities,
        auth_config=data.auth,
        config=data.config,
        enabled=False,
        error=error_msg,
    )
    db.add(plugin)
    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin(
    plugin_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Plugin).where(
            Plugin.id == plugin_id,
            Plugin.org_id == current_user["org_id"],
        )
    )
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return plugin


@router.put("/{plugin_id}", response_model=PluginResponse)
async def update_plugin(
    plugin_id: UUID,
    data: PluginUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update plugins")

    result = await db.execute(
        select(Plugin).where(
            Plugin.id == plugin_id,
            Plugin.org_id == current_user["org_id"],
        )
    )
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")

    if data.display_name is not None:
        plugin.display_name = data.display_name
    if data.version is not None:
        plugin.version = data.version
    if data.tier is not None:
        plugin.tier = data.tier
    if data.entry_point is not None:
        plugin.entry_point = data.entry_point
    if data.capabilities is not None:
        plugin.capabilities = data.capabilities
    if data.auth is not None:
        plugin.auth_config = data.auth
    if data.config is not None:
        plugin.config = data.config

    # Re-validate if entry_point changed
    if data.entry_point is not None:
        connector_class = load_plugin_from_path(data.entry_point, plugin.name)
        plugin.error = None if connector_class else f"Failed to load from {data.entry_point}"

    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.post("/{plugin_id}/activate", response_model=PluginResponse)
async def activate_plugin(
    plugin_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can activate plugins")

    result = await db.execute(
        select(Plugin).where(
            Plugin.id == plugin_id,
            Plugin.org_id == current_user["org_id"],
        )
    )
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")

    if plugin.error:
        raise HTTPException(status_code=400, detail=f"Cannot activate: {plugin.error}")

    # Load and validate the plugin
    connector_class = load_plugin_from_path(plugin.entry_point, plugin.name)
    if not connector_class:
        plugin.error = f"Failed to load from {plugin.entry_point}"
        plugin.enabled = False
        await db.commit()
        raise HTTPException(status_code=400, detail=plugin.error)

    # Instantiate to verify it works
    try:
        instance = instantiate_plugin(connector_class)
        if not instance.manifest:
            raise HTTPException(status_code=400, detail="Plugin has no manifest")
    except Exception as e:
        plugin.error = str(e)
        plugin.enabled = False
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Plugin validation failed: {e}")

    from datetime import datetime, timezone
    plugin.enabled = True
    plugin.error = None
    plugin.activated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.post("/{plugin_id}/deactivate", response_model=PluginResponse)
async def deactivate_plugin(
    plugin_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can deactivate plugins")

    result = await db.execute(
        select(Plugin).where(
            Plugin.id == plugin_id,
            Plugin.org_id == current_user["org_id"],
        )
    )
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")

    plugin.enabled = False
    unload_plugin(plugin.name, plugin.entry_point)
    await db.commit()
    await db.refresh(plugin)
    return plugin


@router.delete("/{plugin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def uninstall_plugin(
    plugin_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can uninstall plugins")

    result = await db.execute(
        select(Plugin).where(
            Plugin.id == plugin_id,
            Plugin.org_id == current_user["org_id"],
        )
    )
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")

    unload_plugin(plugin.name, plugin.entry_point)
    await db.delete(plugin)
    await db.commit()
