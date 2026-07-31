"""Phase G: connector_types table — Gap 29

Revision ID: 008_phase_g
Revises: 007_phase_f
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

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
    op.execute("""
        INSERT INTO connector_types (name, display_name, tier, auth_type, capabilities) VALUES
        ('youtube', 'YouTube', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":true}'),
        ('reddit', 'Reddit', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":false}'),
        ('whatsapp', 'WhatsApp', 'full', 'api_key', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":true}'),
        ('telegram', 'Telegram', 'full', 'api_key', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":true}'),
        ('instagram', 'Instagram', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":false}'),
        ('twitter', 'Twitter', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":false}'),
        ('facebook', 'Facebook', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":true}'),
        ('linkedin', 'LinkedIn', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":false}'),
        ('tiktok', 'TikTok', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":true,"webhooks":false}'),
        ('discord', 'Discord', 'full', 'api_key', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":true}'),
        ('slack', 'Slack', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":true}'),
        ('mastodon', 'Mastodon', 'full', 'oauth2', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":true}'),
        ('pinterest', 'Pinterest', 'full', 'oauth2', '{"read":true,"write":true,"moderate":false,"analytics":true,"webhooks":false}'),
        ('snapchat', 'Snapchat', 'lightweight', 'oauth2', '{"read":true,"write":false,"moderate":false,"analytics":false,"webhooks":false}'),
        ('bluesky', 'Bluesky', 'full', 'api_key', '{"read":true,"write":true,"moderate":true,"analytics":false,"webhooks":false}')
    """)


def downgrade() -> None:
    op.drop_table("connector_types")
