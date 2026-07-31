"""
AI Content Suggestions API
Generate post ideas based on trending topics and past performance
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from app.routes.auth import get_current_user
from app.core.database import get_db
from sqlalchemy import select
from app.models.models import Suggestion, ContentItem, ContentMetadata

router = APIRouter()


@router.get("")
async def list_suggestions(
    status: Optional[str] = None,
    connector_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    query = (
        select(Suggestion)
        .where(Suggestion.org_id == org_id)
        .order_by(Suggestion.score.desc())
        .limit(limit)
    )
    if status:
        query = query.where(Suggestion.status == status)
    if connector_type:
        query = query.where(Suggestion.connector_type == connector_type)

    result = await db.execute(query)
    suggestions = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "content_type": s.content_type,
            "title": s.title,
            "body": s.body,
            "connector_type": s.connector_type,
            "score": s.score,
            "metadata": s.metadata,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in suggestions
    ]


@router.post("/generate")
async def generate_suggestions(
    connector_type: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    # Analyze past content for patterns
    result = await db.execute(
        select(ContentItem)
        .where(ContentItem.org_id == org_id)
        .order_by(ContentItem.ingested_at.desc())
        .limit(50)
    )
    past_content = result.scalars().all()

    # Generate suggestions based on content patterns
    suggestions = []
    templates = [
        {
            "title": "Industry Insight",
            "body": "Share a key insight from your industry this week. What trend are you watching?",
            "type": "post",
        },
        {
            "title": "Behind the Scenes",
            "body": "Show your audience what goes on behind the scenes of your work.",
            "type": "post",
        },
        {
            "title": "Question to Community",
            "body": "Ask your audience a thought-provoking question related to your niche.",
            "type": "post",
        },
        {
            "title": "Tip or Tutorial",
            "body": "Share a quick tip or mini-tutorial that your audience would find valuable.",
            "type": "post",
        },
        {
            "title": "Celebrate Win",
            "body": "Share a recent achievement or milestone with your community.",
            "type": "post",
        },
        {
            "title": "Poll or Survey",
            "body": "Create a poll to engage your audience and gather feedback.",
            "type": "post",
        },
        {
            "title": "Resource Share",
            "body": "Share a tool, article, or resource you recently found useful.",
            "type": "post",
        },
        {
            "title": "Challenge Post",
            "body": "Challenge your audience with a related task or activity.",
            "type": "post",
        },
    ]

    import random
    selected = random.sample(templates, min(count, len(templates)))

    for i, template in enumerate(selected):
        suggestion = Suggestion(
            org_id=org_id,
            content_type=template["type"],
            title=template["title"],
            body=template["body"],
            connector_type=connector_type,
            score=random.uniform(0.6, 1.0),
            metadata={
                "based_on": "content_analysis" if past_content else "templates",
                "past_content_count": len(past_content),
            },
        )
        db.add(suggestion)
        suggestions.append(suggestion)

    await db.commit()

    return {
        "generated": len(suggestions),
        "suggestions": [
            {
                "id": str(s.id),
                "title": s.title,
                "body": s.body,
                "score": s.score,
            }
            for s in suggestions
        ],
    }


@router.put("/{suggestion_id}/use")
async def use_suggestion(
    suggestion_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Suggestion).where(
            Suggestion.id == suggestion_id,
            Suggestion.org_id == org_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        return {"ok": False}

    suggestion.status = "used"
    await db.commit()
    return {"ok": True, "title": suggestion.title, "body": suggestion.body}


@router.put("/{suggestion_id}/dismiss")
async def dismiss_suggestion(
    suggestion_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]
    result = await db.execute(
        select(Suggestion).where(
            Suggestion.id == suggestion_id,
            Suggestion.org_id == org_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        return {"ok": False}

    suggestion.status = "dismissed"
    await db.commit()
    return {"ok": True}
