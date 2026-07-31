from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("linkedin")

router = APIRouter()


@router.get("/{service_id}/linkedin/profile")
async def get_linkedin_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("linkedin")
    if not connector:
        raise HTTPException(status_code=404, detail="LinkedIn connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/linkedin/posts")
async def get_linkedin_posts(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("linkedin")
    if not connector:
        raise HTTPException(status_code=404, detail="LinkedIn connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "posts",
        "person_id": credentials.get("person_id"),
    })
    posts = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"posts": posts, "total": len(posts)}


@router.get("/{service_id}/linkedin/post/{post_urn}/comments")
async def get_linkedin_comments(
    service_id: str,
    post_urn: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("linkedin")
    if not connector:
        raise HTTPException(status_code=404, detail="LinkedIn connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "comments",
        "post_urn": post_urn,
    })
    comments = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"comments": comments, "total": len(comments)}


@router.post("/{service_id}/linkedin/post/{post_urn}/comment")
async def comment_on_linkedin(
    service_id: str,
    post_urn: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("linkedin")
    if not connector:
        raise HTTPException(status_code=404, detail="LinkedIn connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(post_urn, message, access_token=credentials.get("access_token", ""))
    return {"status": "commented"}
