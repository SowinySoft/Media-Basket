from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("tiktok")

router = APIRouter()


@router.get("/{service_id}/tiktok/profile")
async def get_tiktok_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("tiktok")
    if not connector:
        raise HTTPException(status_code=404, detail="TikTok connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/tiktok/videos")
async def get_tiktok_videos(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("tiktok")
    if not connector:
        raise HTTPException(status_code=404, detail="TikTok connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "videos",
    })
    videos = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"videos": videos, "total": len(videos)}


@router.get("/{service_id}/tiktok/video/{video_id}/comments")
async def get_tiktok_comments(
    service_id: str,
    video_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("tiktok")
    if not connector:
        raise HTTPException(status_code=404, detail="TikTok connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "comments",
        "video_id": video_id,
    })
    comments = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"comments": comments, "total": len(comments)}


@router.post("/{service_id}/tiktok/video/{video_id}/comment")
async def comment_on_tiktok(
    service_id: str,
    video_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("tiktok")
    if not connector:
        raise HTTPException(status_code=404, detail="TikTok connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(video_id, message, access_token=credentials.get("access_token", ""))
    return {"status": "commented"}
