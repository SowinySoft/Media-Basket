"""Audit fixes: rename notifications.read → is_read + missing RLS policies

Revision ID: 010_audit_fixes
Revises: 009_phase_l
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_audit_fixes"
down_revision = "009_phase_l"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Rename notifications.read → is_read (reserved word)
    op.alter_column("notifications", "read", new_column_name="is_read")
    op.drop_index("ix_notifications_read", table_name="notifications")
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    # 2. Add missing RLS policies for tables created after initial migration
    tables_needing_rls = [
        "notifications",
        "invitations",
    ]
    for table in tables_needing_rls:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY org_isolation ON {table}
            USING (org_id = current_setting('app.current_tenant')::UUID)
        """)


def downgrade() -> None:
    # Remove RLS policies
    for table in ["notifications", "invitations"]:
        op.execute(f"DROP POLICY IF EXISTS org_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Rename back
    op.alter_column("notifications", "is_read", new_column_name="read")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.create_index("ix_notifications_read", "notifications", ["read"])
