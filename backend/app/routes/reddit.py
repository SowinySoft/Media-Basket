from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.vault import read_secret, store_secret
from app.models.models import ServiceInstance, ContentItem
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

router = APIRouter()


@router.get("/{service_id}/reddit/post/{post_id}/comments")
async def get_post_comments(
    service_id: str,
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("reddit")
    if not connector:
        raise HTTPException(status_code=404, detail="Reddit connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                store_secret(org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]

    comments = await connector.fetch({
        "access_token": access_token,
        "type": "comments",
        "post_id": post_id,
    })

    comment_list = []
    for c in comments:
        payload = c["payload"]
        comment_list.append({
            "id": c["external_id"],
            "author": payload.get("author", "Unknown"),
            "author_avatar": f"https://www.redditstatic.com/avatars/avatar_default_{payload.get('author', 'unknown')}.png",
            "body": payload.get("body", ""),
            "score": payload.get("score", 0),
            "created_utc": payload.get("created_utc", 0),
        })

    return {"comments": comment_list, "total": len(comment_list)}


@router.post("/{service_id}/reddit/comment/{comment_id}/action")
async def moderate_comment(
    service_id: str,
    comment_id: str,
    action: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("reddit")
    if not connector:
        raise HTTPException(status_code=404, detail="Reddit connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                store_secret(org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    result = await connector.moderate(action, comment_id, access_token=access_token)
    return result


@router.post("/{service_id}/reddit/comment/{comment_id}/reply")
async def reply_to_comment(
    service_id: str,
    comment_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("reddit")
    if not connector:
        raise HTTPException(status_code=404, detail="Reddit connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                store_secret(org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    await connector.respond(comment_id, message, access_token=access_token)
    return {"status": "replied"}


@router.get("/{service_id}/reddit/subreddit")
async def get_subreddit_info(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("reddit")
    if not connector:
        raise HTTPException(status_code=404, detail="Reddit connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    if credentials.get("refresh_token"):
        try:
            new_tokens = await connector.refresh_token(credentials["refresh_token"])
            if "access_token" in new_tokens:
                credentials = {**credentials, **new_tokens}
                store_secret(org_id, service_id, credentials)
        except Exception:
            pass

    access_token = credentials["access_token"]
    items = await connector.fetch({"access_token": access_token, "type": "subreddit"})
    if not items:
        return {"subreddit": None}

    sub = items[0]["payload"]

    return {
        "subreddit": {
            "name": sub.get("display_name"),
            "title": sub.get("title"),
            "description": sub.get("public_description"),
            "subscribers": sub.get("subscribers", 0),
            "active_users": sub.get("accounts_active", 0),
            "icon": sub.get("icon_img"),
        }
    }
