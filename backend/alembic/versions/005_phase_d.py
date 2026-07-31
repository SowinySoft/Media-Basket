"""Phase D: Plugin system — plugins table

Revision ID: 005_phase_d
Revises: 004_phase_a
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005_phase_d"
down_revision = "004_phase_a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plugins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False, server_default="lightweight"),
        sa.Column("entry_point", sa.String(500), nullable=False),
        sa.Column("capabilities", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("auth", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("config", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_plugins_org_id", "plugins", ["org_id"])
    op.create_index("ix_plugins_name", "plugins", ["name"])


def downgrade() -> None:
    op.drop_table("plugins")
