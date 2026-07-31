import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func
from pydantic import BaseModel
from uuid import UUID

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import (
    BillingPlan, Member, ServiceInstance, ContentItem,
)
from app.schemas.schemas import BillingPlanResponse
from app.routes.auth import get_current_user
from app.core.logging import get_logger


logger = get_logger("billing")
settings = get_settings()

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()


class CheckoutRequest(BaseModel):
    price_id: str


class WebhookResponse(BaseModel):
    status: str


# ── Plan limits helper ────────────────────────────────────────────────

async def check_plan_limits(org_id: UUID, db: AsyncSession) -> tuple[bool, str]:
    result = await db.execute(
        select(BillingPlan).where(BillingPlan.org_id == org_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        return True, ""

    svc_count = await db.execute(
        select(sql_func.count()).where(ServiceInstance.org_id == org_id)
    )
    member_count = await db.execute(
        select(sql_func.count()).where(Member.org_id == org_id)
    )
    services_used = svc_count.scalar()
    members_used = member_count.scalar()

    if services_used >= plan.max_services:
        return False, f"Service limit reached ({plan.max_services})"
    if members_used >= plan.max_members:
        return False, f"Member limit reached ({plan.max_members})"
    return True, ""


# ── Existing endpoints ────────────────────────────────────────────────

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


# ── Enhanced usage endpoint ──────────────────────────────────────────

@router.get("/usage")
async def get_usage(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user["org_id"]

    result = await db.execute(
        select(BillingPlan).where(BillingPlan.org_id == org_id)
    )
    plan = result.scalar_one_or_none()

    svc_result = await db.execute(
        select(sql_func.count()).where(ServiceInstance.org_id == org_id)
    )
    services_used = svc_result.scalar()

    member_result = await db.execute(
        select(sql_func.count()).where(Member.org_id == org_id)
    )
    members_used = member_result.scalar()

    content_result = await db.execute(
        select(sql_func.count()).where(ContentItem.org_id == org_id)
    )
    content_used = content_result.scalar()

    return {
        "org_id": str(org_id),
        "plan": plan.plan if plan else "free",
        "services_used": services_used,
        "services_limit": plan.max_services if plan else 3,
        "members_used": members_used,
        "members_limit": plan.max_members if plan else 5,
        "content_used": content_used,
        "ml_analyses_used": 0,
        "ml_analyses_limit": plan.max_ml_analyses if plan else 1000,
    }


# ── Stripe Checkout ──────────────────────────────────────────────────

@router.post("/checkout")
async def create_checkout_session(
    data: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can manage billing")

    org_id = current_user["org_id"]

    result = await db.execute(
        select(BillingPlan).where(BillingPlan.org_id == org_id)
    )
    plan = result.scalar_one_or_none()

    if not plan:
        plan = BillingPlan(org_id=org_id, plan="free")
        db.add(plan)
        await db.flush()

    customer_params: dict = {"email": current_user.get("email", "")}
    if plan.stripe_customer_id:
        customer_params["id"] = plan.stripe_customer_id
    else:
        customer_params["metadata"] = {"org_id": str(org_id)}

    try:
        if plan.stripe_customer_id:
            customer = stripe.Customer.retrieve(plan.stripe_customer_id)
        else:
            customer = stripe.Customer.create(**customer_params)
            plan.stripe_customer_id = customer.id
    except stripe.StripeError as e:
        logger.error("stripe_customer_error", error=str(e))
        raise HTTPException(status_code=502, detail="Stripe customer creation failed")

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer.id,
            mode="subscription",
            line_items=[{"price": data.price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/billing?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/billing",
            metadata={"org_id": str(org_id)},
        )
    except stripe.StripeError as e:
        logger.error("stripe_checkout_error", error=str(e))
        raise HTTPException(status_code=502, detail="Stripe checkout session creation failed")

    await db.commit()

    logger.info(
        "checkout_session_created",
        org_id=str(org_id),
        session_id=checkout_session.id,
    )
    return {"checkout_url": checkout_session.url}


# ── Stripe Webhook ───────────────────────────────────────────────────

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    sig_header = request.headers.get("x-stripe-signature", "")

    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                body, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    else:
        try:
            event = stripe.Event.construct_from(
                stripe.util.parse_raw_json_body(body) if hasattr(stripe.util, 'parse_raw_json_body') else {},
                settings.STRIPE_SECRET_KEY or "sk_test",
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Could not parse webhook event")

    event_type = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        org_id = data_obj.get("metadata", {}).get("org_id")
        subscription_id = data_obj.get("subscription")
        customer_id = data_obj.get("customer")

        if org_id:
            result = await db.execute(
                select(BillingPlan).where(BillingPlan.org_id == org_id)
            )
            plan = result.scalar_one_or_none()
            if plan:
                plan.stripe_subscription_id = subscription_id
                if customer_id:
                    plan.stripe_customer_id = customer_id
                await db.commit()
                logger.info("checkout_completed", org_id=org_id)

    elif event_type == "invoice.paid":
        customer_id = data_obj.get("customer")
        if customer_id:
            result = await db.execute(
                select(BillingPlan).where(BillingPlan.stripe_customer_id == customer_id)
            )
            plan = result.scalar_one_or_none()
            if plan:
                period_end = data_obj.get("lines", {}).get("data", [{}])[0].get("period", {}).get("end")
                if period_end:
                    from datetime import datetime, timezone
                    plan.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
                await db.commit()
                logger.info("invoice_paid", customer_id=customer_id)

    elif event_type == "customer.subscription.deleted":
        subscription_id = data_obj.get("id")
        if subscription_id:
            result = await db.execute(
                select(BillingPlan).where(BillingPlan.stripe_subscription_id == subscription_id)
            )
            plan = result.scalar_one_or_none()
            if plan:
                plan.plan = "free"
                plan.max_services = settings.MAX_SERVICES_FREE
                plan.max_members = settings.MAX_MEMBERS_FREE
                plan.max_ml_analyses = settings.MAX_ML_ANALYSES_FREE
                plan.stripe_subscription_id = None
                plan.current_period_end = None
                await db.commit()
                logger.info("subscription_deleted", subscription_id=subscription_id)

    return WebhookResponse(status="ok")
