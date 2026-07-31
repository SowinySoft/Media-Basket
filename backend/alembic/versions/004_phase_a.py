"""Phase A: vault_audit_log + sync_jobs tables

Revision ID: 004_phase_a
Revises: 003_phase4
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004_phase_a"
down_revision = "003_phase4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vault_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_instances.id"), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vault_audit_log_org_id", "vault_audit_log", ["org_id"])
    op.create_index("ix_vault_audit_log_user_id", "vault_audit_log", ["user_id"])
    op.create_index("ix_vault_audit_log_service_id", "vault_audit_log", ["service_id"])
    op.create_index("ix_vault_audit_log_timestamp", "vault_audit_log", ["timestamp"])

    op.create_table(
        "sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("service_instance_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_instances.id"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("result", postgresql.JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sync_jobs_org_id", "sync_jobs", ["org_id"])
    op.create_index("ix_sync_jobs_service_instance_id", "sync_jobs", ["service_instance_id"])
    op.create_index("ix_sync_jobs_status", "sync_jobs", ["status"])

    # Enable RLS on org-scoped tables
    org_scoped_tables = ["vault_audit_log", "sync_jobs"]
    for table in org_scoped_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY org_isolation ON {table}
            USING (org_id = current_setting('app.current_tenant')::UUID)
        """)


def downgrade() -> None:
    op.drop_table("sync_jobs")
    op.drop_table("vault_audit_log")
