from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


# Auth
class UserCreate(BaseModel):
    email: str
    password: str
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    org_id: str
    member_id: str
    role: str
    type: str


# User
class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    auth_provider: str
    created_at: datetime

    class Config:
        from_attributes = True


# Organization
class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


# Member
class MemberResponse(BaseModel):
    id: UUID
    org_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


# Service
class ServiceCreate(BaseModel):
    connector_type: str
    display_name: str


class ServiceResponse(BaseModel):
    id: UUID
    org_id: UUID
    connector_type: str
    display_name: str
    status: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Content
class ContentResponse(BaseModel):
    id: UUID
    service_instance_id: UUID
    external_id: str
    content_type: str
    category: str
    payload: dict
    ingested_at: datetime

    class Config:
        from_attributes = True


# Moderation
class ModerationCreate(BaseModel):
    action: str  # approve | delete | flag | respond
    details: Optional[dict] = None


class ModerationResponse(BaseModel):
    id: UUID
    action: str
    details: Optional[dict] = None
    performed_at: datetime

    class Config:
        from_attributes = True


# Billing
class BillingPlanResponse(BaseModel):
    plan: str
    max_services: int
    max_members: int
    max_ml_analyses: int
    current_period_end: Optional[datetime] = None

    class Config:
        from_attributes = True
