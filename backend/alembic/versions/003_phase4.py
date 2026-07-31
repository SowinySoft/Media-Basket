"""Phase 4 - Tracking Events and Suggestions tables

Revision ID: 003_phase4
Revises: 002_phase1
Create Date: 2026-07-31
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "003_phase4"
down_revision: Union[str, None] = "002_phase1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tracking_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("content_item_id", UUID(as_uuid=True), sa.ForeignKey("content_items.id"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("utm_source", sa.String(100), nullable=True),
        sa.Column("utm_medium", sa.String(100), nullable=True),
        sa.Column("utm_campaign", sa.String(100), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("connector_type", sa.String(50), nullable=True),
        sa.Column("score", sa.Float, server_default="0"),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    org_scoped_tables = ["tracking_events", "suggestions"]
    for table in org_scoped_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY org_isolation ON {table}
            USING (org_id = current_setting('app.current_tenant')::UUID)
        """)


def downgrade() -> None:
    for table in ["suggestions", "tracking_events"]:
        op.execute(f"DROP POLICY IF EXISTS org_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
        op.drop_table(table)
