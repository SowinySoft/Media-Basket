"""Phase G: connector_types table — Gap 29

Revision ID: 008_phase_g
Revises: 007_phase_f
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "008_phase_g"
down_revision = "007_phase_f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connector_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("version", sa.String(20), server_default="1.0.0"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon_url", sa.String(500), nullable=True),
        sa.Column("tier", sa.String(20), server_default="full"),
        sa.Column("capabilities", postgresql.JSONB, server_default="{}"),
        sa.Column("auth_type", sa.String(50), server_default="oauth2"),
        sa.Column("rate_limit_rpm", sa.Integer, nullable=True),
        sa.Column("rate_limit_rpd", sa.Integer, nullable=True),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed with all 15 built-in connectors
    connector_types_table = sa.table(
        "connector_types",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("display_name", sa.String),
        sa.column("tier", sa.String),
        sa.column("auth_type", sa.String),
        sa.column("capabilities", postgresql.JSONB),
    )
    op.bulk_insert(connector_types_table, [
        {"id": uuid.uuid4(), "name": "youtube", "display_name": "YouTube", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "reddit", "display_name": "Reddit", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "whatsapp", "display_name": "WhatsApp", "tier": "full", "auth_type": "api_key", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "telegram", "display_name": "Telegram", "tier": "full", "auth_type": "api_key", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "instagram", "display_name": "Instagram", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "twitter", "display_name": "Twitter", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "facebook", "display_name": "Facebook", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "linkedin", "display_name": "LinkedIn", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "tiktok", "display_name": "TikTok", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "discord", "display_name": "Discord", "tier": "full", "auth_type": "api_key", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "slack", "display_name": "Slack", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "mastodon", "display_name": "Mastodon", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": True}},
        {"id": uuid.uuid4(), "name": "pinterest", "display_name": "Pinterest", "tier": "full", "auth_type": "oauth2", "capabilities": {"read": True, "write": True, "moderate": False, "analytics": True, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "snapchat", "display_name": "Snapchat", "tier": "lightweight", "auth_type": "oauth2", "capabilities": {"read": True, "write": False, "moderate": False, "analytics": False, "webhooks": False}},
        {"id": uuid.uuid4(), "name": "bluesky", "display_name": "Bluesky", "tier": "full", "auth_type": "api_key", "capabilities": {"read": True, "write": True, "moderate": True, "analytics": False, "webhooks": False}},
    ])


def downgrade() -> None:
    op.drop_table("connector_types")
