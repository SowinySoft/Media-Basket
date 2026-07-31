"""Phase F: notifications table + pgAudit status

Revision ID: 007_phase_f
Revises: 006_phase_e
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007_phase_f"
down_revision = "006_phase_e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_org_id", "notifications", ["org_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_read", "notifications", ["read"])

    # 2. Enable pgAudit if available (non-fatal if extension not installed)
    op.execute("CREATE EXTENSION IF NOT EXISTS pgaudit")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS pgaudit")
    op.drop_table("notifications")
