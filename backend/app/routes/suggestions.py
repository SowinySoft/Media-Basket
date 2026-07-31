"""
AI Content Suggestions API
Generate post ideas using OpenAI/Claude API or template fallback
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
import json
import httpx
from app.routes.auth import get_current_user
from app.core.database import get_db
from app.core.config import get_settings
from sqlalchemy import select
from app.models.models import Suggestion, ContentItem

router = APIRouter()
settings = get_settings()


async def generate_with_openai(prompt: str, count: int = 5) -> list[dict]:
    """Generate content suggestions using OpenAI API"""
    if not settings.OPENAI_API_KEY:
        return []

    system_prompt = """You are a social media content strategist. Generate engaging post ideas.
Return a JSON array with objects containing: title, body, content_type.
Keep titles short (5-8 words) and bodies concise (1-2 sentences).
Focus on engagement, value, and community building."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Generate {count} social media post ideas. {prompt}"},
                    ],
                    "temperature": 0.8,
                    "max_tokens": 1000,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                # Try to parse JSON from response
                start = content.find("[")
                end = content.rfind("]") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
    except Exception:
        pass
    return []


async def generate_with_claude(prompt: str, count: int = 5) -> list[dict]:
    """Generate content suggestions using Anthropic Claude API"""
    if not settings.ANTHROPIC_API_KEY:
        return []

    system_prompt = """You are a social media content strategist. Generate engaging post ideas.
Return a JSON array with objects containing: title, body, content_type.
Keep titles short (5-8 words) and bodies concise (1-2 sentences).
Focus on engagement, value, and community building."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 1000,
                    "system": system_prompt,
                    "messages": [
                        {"role": "user", "content": f"Generate {count} social media post ideas. {prompt}"},
                    ],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["content"][0]["text"]
                start = content.find("[")
                end = content.rfind("]") + 1
                if start >= 0 and end > start:
                    return json.loads(content[start:end])
    except Exception:
        pass
    return []


TEMPLATE_SUGGESTIONS = [
    {"title": "Industry Insight", "body": "Share a key insight from your industry this week. What trend are you watching?", "content_type": "post"},
    {"title": "Behind the Scenes", "body": "Show your audience what goes on behind the scenes of your work.", "content_type": "post"},
    {"title": "Question to Community", "body": "Ask your audience a thought-provoking question related to your niche.", "content_type": "post"},
    {"title": "Tip or Tutorial", "body": "Share a quick tip or mini-tutorial that your audience would find valuable.", "content_type": "post"},
    {"title": "Celebrate Win", "body": "Share a recent achievement or milestone with your community.", "content_type": "post"},
    {"title": "Poll or Survey", "body": "Create a poll to engage your audience and gather feedback.", "content_type": "post"},
    {"title": "Resource Share", "body": "Share a tool, article, or resource you recently found useful.", "content_type": "post"},
    {"title": "Challenge Post", "body": "Challenge your audience with a related task or activity.", "content_type": "post"},
    {"title": "User Spotlight", "body": "Highlight a community member, customer, or their success story.", "content_type": "post"},
    {"title": "Myth Busting", "body": "Debunk a common misconception in your industry.", "content_type": "post"},
]


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
            "suggestion_metadata": s.suggestion_metadata,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in suggestions
    ]


@router.post("/generate")
async def generate_suggestions(
    connector_type: Optional[str] = None,
    count: int = Query(5, ge=1, le=10),
    prompt: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    org_id = current_user["org_id"]

    # Try AI providers first, fall back to templates
    ai_suggestions = []

    if prompt or settings.OPENAI_API_KEY:
        ai_suggestions = await generate_with_openai(
            prompt or "Generate engaging social media post ideas",
            count,
        )

    if not ai_suggestions and (prompt or settings.ANTHROPIC_API_KEY):
        ai_suggestions = await generate_with_claude(
            prompt or "Generate engaging social media post ideas",
            count,
        )

    # Fall back to template-based suggestions
    if not ai_suggestions:
        import random
        ai_suggestions = random.sample(TEMPLATE_SUGGESTIONS, min(count, len(TEMPLATE_SUGGESTIONS)))

    suggestions = []
    import random
    for template in ai_suggestions[:count]:
        suggestion = Suggestion(
            org_id=org_id,
            content_type=template.get("content_type", "post"),
            title=template.get("title", "Untitled"),
            body=template.get("body", ""),
            connector_type=connector_type,
            score=random.uniform(0.7, 1.0),
            suggestion_metadata={
                "source": "openai" if settings.OPENAI_API_KEY else ("claude" if settings.ANTHROPIC_API_KEY else "templates"),
                "prompt": prompt,
            },
        )
        db.add(suggestion)
        suggestions.append(suggestion)

    await db.commit()

    return {
        "generated": len(suggestions),
        "source": suggestions[0].suggestion_metadata.get("source", "templates") if suggestions else "templates",
        "suggestions": [
            {
                "id": str(s.id),
                "title": s.title,
                "body": s.body,
                "score": s.score,
                "source": s.suggestion_metadata.get("source", "templates"),
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
