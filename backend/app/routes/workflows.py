"""Workflow Control API — CRUD + execute + templates."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import Workflow, WorkflowExecution
from app.routes.auth import get_current_user
from app.core.logging import get_logger
from app.core.workflow_engine import WorkflowEngine
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

router = APIRouter()
logger = get_logger("workflows")


# ── Schemas ──────────────────────────────────────────────

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str  # content.new | content.flagged | schedule | webhook | manual
    trigger_config: dict = {}
    steps: list[dict] = []


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[dict] = None
    steps: Optional[list[dict]] = None


class WorkflowStep(BaseModel):
    type: str  # condition | action | delay | branch
    config: dict = {}


class ExecuteRequest(BaseModel):
    trigger_data: dict = {}


# ── CRUD ─────────────────────────────────────────────────

@router.get("", response_model=list[dict])
async def list_workflows(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.org_id == current_user["org_id"])
        .order_by(Workflow.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_to_dict(w) for w in result.scalars().all()]


@router.post("", status_code=201)
async def create_workflow(
    data: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    workflow = Workflow(
        org_id=current_user["org_id"],
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        trigger_config=data.trigger_config,
        steps=data.steps,
    )
    db.add(workflow)
    await db.flush()
    await db.refresh(workflow)
    return _to_dict(workflow)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.org_id == current_user["org_id"])
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _to_dict(workflow)


@router.put("/{workflow_id}")
async def update_workflow(
    workflow_id: UUID,
    data: WorkflowUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.org_id == current_user["org_id"])
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.enabled is not None:
        workflow.enabled = data.enabled
    if data.trigger_type is not None:
        workflow.trigger_type = data.trigger_type
    if data.trigger_config is not None:
        workflow.trigger_config = data.trigger_config
    if data.steps is not None:
        workflow.steps = data.steps

    await db.flush()
    await db.refresh(workflow)
    return _to_dict(workflow)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.org_id == current_user["org_id"])
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)


@router.post("/{workflow_id}/toggle")
async def toggle_workflow(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.org_id == current_user["org_id"])
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow.enabled = not workflow.enabled
    await db.flush()
    return {"enabled": workflow.enabled}


# ── Execute ──────────────────────────────────────────────

@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: UUID,
    req: ExecuteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    engine = WorkflowEngine(db, current_user["org_id"])
    result = await engine.execute_workflow(str(workflow_id), req.trigger_data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── History ──────────────────────────────────────────────

@router.get("/{workflow_id}/executions")
async def list_executions(
    workflow_id: UUID,
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowExecution)
        .where(
            WorkflowExecution.workflow_id == workflow_id,
            WorkflowExecution.org_id == current_user["org_id"],
        )
        .order_by(WorkflowExecution.started_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": str(e.id),
            "status": e.status,
            "trigger_data": e.trigger_data,
            "step_results": e.step_results,
            "error": e.error,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in result.scalars().all()
    ]


# ── Templates ────────────────────────────────────────────

@router.get("/templates/list")
async def list_templates():
    return WORKFLOW_TEMPLATES


WORKFLOW_TEMPLATES = [
    {
        "id": "auto_flag_toxic",
        "name": "Auto-Flag Toxic Content",
        "description": "Automatically flag content with high toxicity scores",
        "trigger_type": "content.new",
        "trigger_config": {"connector_type": "any"},
        "steps": [
            {"type": "condition", "config": {"field": "toxicity_score", "operator": "greater_than", "value": "0.7"}},
            {"type": "action", "config": {"action_type": "flag_content", "reasons": ["auto_toxic"]}},
            {"type": "action", "config": {"action_type": "notify", "title": "Toxic content flagged", "body": "Content auto-flagged for toxicity"}},
        ],
    },
    {
        "id": "sentiment_alert",
        "name": "Negative Sentiment Alert",
        "description": "Alert when negative sentiment is detected",
        "trigger_type": "content.new",
        "trigger_config": {},
        "steps": [
            {"type": "condition", "config": {"field": "sentiment", "operator": "equals", "value": "negative"}},
            {"type": "action", "config": {"action_type": "notify", "title": "Negative sentiment detected", "body": "Content has negative sentiment"}},
        ],
    },
    {
        "id": "engagement_boost",
        "name": "High Engagement Auto-Share",
        "description": "Auto-share content with high engagement across platforms",
        "trigger_type": "content.new",
        "trigger_config": {},
        "steps": [
            {"type": "condition", "config": {"field": "likes", "operator": "greater_than", "value": "100"}},
            {"type": "action", "config": {"action_type": "log", "message": "High engagement content detected"}},
            {"type": "action", "config": {"action_type": "update_status", "new_status": "scheduled"}},
        ],
    },
    {
        "id": "spam_filter",
        "name": "Spam Content Filter",
        "description": "Filter and quarantine suspected spam content",
        "trigger_type": "content.new",
        "trigger_config": {},
        "steps": [
            {"type": "condition", "config": {"field": "spam_score", "operator": "greater_than", "value": "0.8"}},
            {"type": "action", "config": {"action_type": "flag_content", "reasons": ["spam_detected"]}},
            {"type": "action", "config": {"action_type": "notify", "title": "Spam detected", "body": "Content quarantined as spam"}},
        ],
    },
    {
        "id": "daily_digest",
        "name": "Daily Digest Notification",
        "description": "Send a daily summary notification",
        "trigger_type": "schedule",
        "trigger_config": {"cron": "0 9 * * *"},
        "steps": [
            {"type": "action", "config": {"action_type": "notify", "title": "Daily Digest", "body": "Here is your daily content summary"}},
        ],
    },
    {
        "id": "multi_platform_post",
        "name": "Cross-Platform Publisher",
        "description": "Publish content to multiple platforms via webhook",
        "trigger_type": "manual",
        "trigger_config": {},
        "steps": [
            {"type": "condition", "config": {"field": "approved", "operator": "equals", "value": "true"}},
            {"type": "action", "config": {"action_type": "update_status", "new_status": "publishing"}},
            {"type": "action", "config": {"action_type": "log", "message": "Publishing to connected platforms"}},
        ],
    },
]


def _to_dict(workflow: Workflow) -> dict:
    return {
        "id": str(workflow.id),
        "org_id": str(workflow.org_id),
        "name": workflow.name,
        "description": workflow.description,
        "enabled": workflow.enabled,
        "trigger_type": workflow.trigger_type,
        "trigger_config": workflow.trigger_config,
        "steps": workflow.steps,
        "last_run_at": workflow.last_run_at.isoformat() if workflow.last_run_at else None,
        "last_run_status": workflow.last_run_status,
        "run_count": workflow.run_count,
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
    }
