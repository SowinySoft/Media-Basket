from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector
from app.core.logging import get_logger


logger = get_logger("twitter")

router = APIRouter()


@router.get("/{service_id}/twitter/profile")
async def get_twitter_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("twitter")
    if not connector:
        raise HTTPException(status_code=404, detail="Twitter connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/twitter/tweets")
async def get_twitter_tweets(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("twitter")
    if not connector:
        raise HTTPException(status_code=404, detail="Twitter connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "tweets",
        "user_id": credentials.get("user_id"),
    })
    tweets = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"tweets": tweets, "total": len(tweets)}


@router.get("/{service_id}/twitter/mentions")
async def get_twitter_mentions(
    service_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("twitter")
    if not connector:
        raise HTTPException(status_code=404, detail="Twitter connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "mentions",
        "user_id": credentials.get("user_id"),
    })
    mentions = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"mentions": mentions, "total": len(mentions)}


@router.post("/{service_id}/twitter/tweet")
async def post_tweet(
    service_id: str,
    message: str,
    reply_to: str = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]
    connector = get_connector("twitter")
    if not connector:
        raise HTTPException(status_code=404, detail="Twitter connector not found")

    credentials = await read_secret(db, org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    import httpx
    async with httpx.AsyncClient() as client:
        payload = {"text": message}
        if reply_to:
            payload["reply"] = {"in_reply_to_tweet_id": reply_to}
        resp = await client.post(
            "https://api.twitter.com/2/tweets",
            json=payload,
            headers={"Authorization": f"Bearer {credentials.get('access_token', '')}"},
        )
    return {"status": "posted", "response": resp.json()}
