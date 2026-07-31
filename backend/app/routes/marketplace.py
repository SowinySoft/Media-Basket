"""Plugin Marketplace — browse, install, and manage third-party plugins."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.models.models import Plugin
from app.routes.auth import get_current_user
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.core.logging import get_logger

logger = get_logger("marketplace")
router = APIRouter()


class MarketplacePlugin(BaseModel):
    """Public plugin listing for the marketplace."""
    name: str
    display_name: str
    description: str
    version: str
    tier: str
    author: str
    category: str
    install_count: int = 0
    rating: float = 0.0
    capabilities: dict = {}
    tags: list[str] = []


# Curated marketplace listings (seed data)
MARKETPLACE_CATALOG: list[dict] = [
    {
        "name": "custom-youtube-analytics",
        "display_name": "YouTube Analytics Pro",
        "description": "Advanced YouTube analytics with subscriber growth tracking and competitor analysis.",
        "version": "1.2.0",
        "tier": "full",
        "author": "MediaBasket",
        "category": "analytics",
        "install_count": 150,
        "rating": 4.8,
        "capabilities": {"reads": ["analytics", "subscribers", "competitors"]},
        "tags": ["youtube", "analytics", "growth"],
        "entry_point": "mediabasket_plugins.youtube_analytics:Connector",
    },
    {
        "name": "auto-moderator",
        "display_name": "Auto Moderator",
        "description": "AI-powered auto-moderation with custom rules, spam detection, and sentiment thresholds.",
        "version": "2.0.1",
        "tier": "full",
        "author": "MediaBasket",
        "category": "moderation",
        "install_count": 320,
        "rating": 4.9,
        "capabilities": {"reads": ["content", "comments"], "writes": ["moderation"]},
        "tags": ["moderation", "ai", "automation"],
        "entry_point": "mediabasket_plugins.auto_moderator:Connector",
    },
    {
        "name": "cross-poster",
        "display_name": "Cross-Poster",
        "description": "Automatically cross-post content across multiple platforms with format adaptation.",
        "version": "1.5.0",
        "tier": "full",
        "author": "Community",
        "category": "publishing",
        "install_count": 89,
        "rating": 4.3,
        "capabilities": {"reads": ["content"], "writes": ["posts", "tweets", "statuses"]},
        "tags": ["cross-posting", "automation", "scheduling"],
        "entry_point": "mediabasket_plugins.cross_poster:Connector",
    },
    {
        "name": "slack-notifier",
        "display_name": "Slack Notifier",
        "description": "Send real-time notifications to Slack channels for new content, alerts, and moderation events.",
        "version": "1.0.0",
        "tier": "lightweight",
        "author": "Community",
        "category": "notifications",
        "install_count": 67,
        "rating": 4.1,
        "capabilities": {"reads": ["notifications"], "writes": ["slack-messages"]},
        "tags": ["slack", "notifications", "alerts"],
        "entry_point": "mediabasket_plugins.slack_notifier:Connector",
    },
    {
        "name": "content-scheduler",
        "display_name": "Advanced Scheduler",
        "description": "Content scheduling with queue management, optimal time suggestions, and calendar view.",
        "version": "1.3.0",
        "tier": "full",
        "author": "MediaBasket",
        "category": "scheduling",
        "install_count": 210,
        "rating": 4.6,
        "capabilities": {"reads": ["calendar", "analytics"], "writes": ["scheduled-posts"]},
        "tags": ["scheduling", "calendar", "optimization"],
        "entry_point": "mediabasket_plugins.advanced_scheduler:Connector",
    },
    {
        "name": "competitor-tracker",
        "display_name": "Competitor Tracker",
        "description": "Track competitor social media accounts, analyze their content, and get insights.",
        "version": "1.1.0",
        "tier": "full",
        "author": "MediaBasket",
        "category": "analytics",
        "install_count": 95,
        "rating": 4.4,
        "capabilities": {"reads": ["competitor-content", "analytics"]},
        "tags": ["competitors", "analytics", "tracking"],
        "entry_point": "mediabasket_plugins.competitor_tracker:Connector",
    },
]


@router.get("/catalog", response_model=list[MarketplacePlugin])
async def list_marketplace_plugins(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
):
    """Browse available plugins in the marketplace."""
    plugins = MARKETPLACE_CATALOG.copy()

    if category:
        plugins = [p for p in plugins if p["category"] == category]
    if tier:
        plugins = [p for p in plugins if p["tier"] == tier]
    if search:
        search_lower = search.lower()
        plugins = [p for p in plugins if search_lower in p["name"].lower() or search_lower in p["display_name"].lower() or search_lower in " ".join(p["tags"])]

    return plugins


@router.get("/catalog/{plugin_name}", response_model=MarketplacePlugin)
async def get_marketplace_plugin(plugin_name: str):
    """Get details for a specific marketplace plugin."""
    for p in MARKETPLACE_CATALOG:
        if p["name"] == plugin_name:
            return p
    raise HTTPException(status_code=404, detail="Plugin not found in marketplace")


@router.get("/categories")
async def list_categories():
    """List all plugin categories."""
    categories = {}
    for p in MARKETPLACE_CATALOG:
        cat = p["category"]
        categories[cat] = categories.get(cat, 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(categories.items())]


@router.post("/install/{plugin_name}", status_code=201)
async def install_from_marketplace(
    plugin_name: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Install a plugin from the marketplace into the user's org."""
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can install plugins")

    # Find in catalog
    catalog_entry = None
    for p in MARKETPLACE_CATALOG:
        if p["name"] == plugin_name:
            catalog_entry = p
            break

    if not catalog_entry:
        raise HTTPException(status_code=404, detail="Plugin not found in marketplace")

    # Check if already installed
    existing = await db.execute(
        select(Plugin).where(
            Plugin.org_id == current_user["org_id"],
            Plugin.name == plugin_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Plugin already installed")

    plugin = Plugin(
        org_id=current_user["org_id"],
        name=catalog_entry["name"],
        display_name=catalog_entry["display_name"],
        version=catalog_entry["version"],
        tier=catalog_entry["tier"],
        entry_point=catalog_entry["entry_point"],
        capabilities=catalog_entry["capabilities"],
        enabled=False,
    )
    db.add(plugin)
    await db.commit()
    await db.refresh(plugin)

    logger.info("plugin_installed_from_marketplace", plugin=plugin_name, org_id=current_user["org_id"])
    return plugin
