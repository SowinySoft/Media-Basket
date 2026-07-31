"""
Content Scheduling API
Schedule posts across all connected platforms
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.routes.auth import get_current_user
from app.core.scheduler import ContentScheduler, ScheduledPost, ScheduleStatus
from app.core.api_response import success_response, error_response, paginated_response
from app.core.database import get_db
from app.core.logging import get_logger


logger = get_logger("scheduler")
router = APIRouter()


class SchedulePostRequest(BaseModel):
    service_id: str
    connector_type: str
    content: str
    scheduled_at: datetime
    media_urls: Optional[list[str]] = None
    reply_to: Optional[str] = None


@router.post("/schedule")
async def schedule_post(
    request: SchedulePostRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Schedule a post for publishing"""
    org_id = current_user["org_id"]
    
    post = ScheduledPost(
        org_id=org_id,
        service_id=request.service_id,
        connector_type=request.connector_type,
        content=request.content,
        scheduled_at=request.scheduled_at,
        media_urls=request.media_urls,
        reply_to=request.reply_to,
    )
    
    scheduler = ContentScheduler(db)
    result = await scheduler.schedule(post)
    
    return success_response(data=result.dict(), message="Post scheduled successfully")


@router.get("/scheduled")
async def list_scheduled_posts(
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List all scheduled posts"""
    org_id = current_user["org_id"]
    
    scheduler = ContentScheduler(db)
    posts = await scheduler.get_pending(org_id)
    
    # Filter by status if provided
    if status:
        posts = [p for p in posts if p["status"] == status]
    
    return paginated_response(
        data=posts,
        total=len(posts),
        page=page,
        page_size=page_size,
    )


@router.post("/schedule/{post_id}/cancel")
async def cancel_scheduled_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Cancel a scheduled post"""
    org_id = current_user["org_id"]
    
    scheduler = ContentScheduler(db)
    success = await scheduler.cancel(post_id, org_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Post not found or cannot be cancelled")
    
    return success_response(message="Post cancelled successfully")


@router.post("/schedule/{post_id}/publish")
async def publish_now(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Immediately publish a scheduled post"""
    org_id = current_user["org_id"]
    
    scheduler = ContentScheduler(db)
    result = await scheduler.publish_now(post_id, org_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return success_response(data=result, message="Post published successfully")


@router.post("/publish")
async def publish_directly(
    request: SchedulePostRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Publish content directly without scheduling"""
    from app.connectors.registry import get_connector
    from app.core.vault import read_secret
    

    org_id = current_user["org_id"]
    
    # Get connector and credentials
    connector = get_connector(request.connector_type)
    if not connector:
        raise HTTPException(status_code=404, detail=f"Connector not found: {request.connector_type}")
    
    credentials = await read_secret(db, org_id, request.service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials found")
    
    try:
        token = credentials.get("access_token") or credentials.get("bot_token")
        await connector.respond(
            request.reply_to or "",
            request.content,
            token=token,
        )
        
        return success_response(message="Content published successfully")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
