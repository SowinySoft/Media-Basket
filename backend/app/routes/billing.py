from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import BillingPlan
from app.schemas.schemas import BillingPlanResponse
from app.routes.auth import get_current_user

router = APIRouter()


@router.get("/plan", response_model=BillingPlanResponse)
async def get_billing_plan(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BillingPlan).where(BillingPlan.org_id == current_user["org_id"])
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return BillingPlanResponse(
            plan="free", max_services=3, max_members=5, max_ml_analyses=1000
        )
    return plan


@router.get("/usage")
async def get_billing_usage(
    current_user: dict = Depends(get_current_user),
):
    return {
        "org_id": current_user["org_id"],
        "plan": "free",
        "services_used": 0,
        "members_used": 1,
        "ml_analyses_used": 0,
    }
