"""Phase L: invitations table

Revision ID: 009_phase_l
Revises: 008_phase_g
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_phase_l"
down_revision = "008_phase_g"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), server_default="member"),
        sa.Column("token", sa.String(255), unique=True, nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("accepted", sa.Boolean, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invitations_token", "invitations", ["token"], unique=True)
    op.create_index("ix_invitations_email", "invitations", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_invitations_email", table_name="invitations")
    op.drop_index("ix_invitations_token", table_name="invitations")
    op.drop_table("invitations")
