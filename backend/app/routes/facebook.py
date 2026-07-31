from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("facebook")

router = APIRouter()


@router.get("/{service_id}/facebook/profile")
async def get_facebook_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("facebook")
    if not connector:
        raise HTTPException(status_code=404, detail="Facebook connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/facebook/pages")
async def get_facebook_pages(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("facebook")
    if not connector:
        raise HTTPException(status_code=404, detail="Facebook connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "pages"})
    pages = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"pages": pages, "total": len(pages)}


@router.get("/{service_id}/facebook/page/{page_id}/posts")
async def get_facebook_posts(
    service_id: str,
    page_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("facebook")
    if not connector:
        raise HTTPException(status_code=404, detail="Facebook connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "posts",
        "page_id": page_id,
        "page_token": credentials.get("page_token"),
    })
    posts = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"posts": posts, "total": len(posts)}


@router.get("/{service_id}/facebook/post/{post_id}/comments")
async def get_facebook_comments(
    service_id: str,
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("facebook")
    if not connector:
        raise HTTPException(status_code=404, detail="Facebook connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "comments",
        "post_id": post_id,
    })
    comments = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"comments": comments, "total": len(comments)}


@router.post("/{service_id}/facebook/post/{post_id}/comment")
async def comment_on_facebook(
    service_id: str,
    post_id: str,
    message: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("facebook")
    if not connector:
        raise HTTPException(status_code=404, detail="Facebook connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    await connector.respond(post_id, message, access_token=credentials.get("access_token", ""))
    return {"status": "commented"}
