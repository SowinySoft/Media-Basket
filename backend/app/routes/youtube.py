from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.vault import read_secret, store_secret
from app.models.models import ServiceInstance, ContentItem
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("youtube")

router = APIRouter()


@router.get("/{service_id}/youtube/video/{video_id}")
async def get_video_details(
    service_id: str,
    video_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("youtube")
    if not connector:
        raise HTTPException(status_code=404, detail="YouTube connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                await store_secret(db, org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]

    comments = await connector.fetch({
        "access_token": access_token,
        "type": "comments",
        "video_id": video_id,
    })

    comment_list = []
    for c in comments:
        snippet = c["payload"].get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
        comment_list.append({
            "id": c["external_id"],
            "author": snippet.get("authorDisplayName", "Unknown"),
            "author_avatar": snippet.get("authorProfileImageUrl", ""),
            "text": snippet.get("textDisplay", ""),
            "likes": snippet.get("likeCount", 0),
            "published_at": snippet.get("publishedAt", ""),
            "updated_at": snippet.get("updatedAt", ""),
            "moderation_status": snippet.get(" moderationDetails", {}).get("commentModerationStatus", "published"),
        })

    return {"comments": comment_list, "total": len(comment_list)}


@router.post("/{service_id}/youtube/comment/{comment_id}/action")
async def moderate_comment(
    service_id: str,
    comment_id: str,
    action: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("youtube")
    if not connector:
        raise HTTPException(status_code=404, detail="YouTube connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                await store_secret(db, org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    result = await connector.moderate(action, comment_id, access_token=access_token)
    return result


@router.post("/{service_id}/youtube/comment/{comment_id}/reply")
async def reply_to_comment(
    service_id: str,
    comment_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("youtube")
    if not connector:
        raise HTTPException(status_code=404, detail="YouTube connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                await store_secret(db, org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    await connector.respond(comment_id, message, access_token=access_token)
    return {"status": "replied"}


@router.get("/{service_id}/youtube/channel")
async def get_channel_info(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("youtube")
    if not connector:
        raise HTTPException(status_code=404, detail="YouTube connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                await store_secret(db, org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    items = await connector.fetch({"access_token": access_token, "type": "channel"})
    if not items:
        return {"channel": None}

    ch = items[0]["payload"]
    snippet = ch.get("snippet", {})
    stats = ch.get("statistics", {})

    return {
        "channel": {
            "id": ch.get("id"),
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url"),
            "custom_url": snippet.get("customUrl"),
            "subscribers": stats.get("subscriberCount", "0"),
            "total_views": stats.get("viewCount", "0"),
            "video_count": stats.get("videoCount", "0"),
        }
    }
