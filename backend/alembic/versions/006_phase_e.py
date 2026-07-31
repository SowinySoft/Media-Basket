"""Phase E Critical: vault encryption columns, service_permissions, session blacklist

Revision ID: 006_phase_e
Revises: 005_phase_d
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006_phase_e"
down_revision = "005_phase_d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add service_permissions to members
    op.add_column(
        "members",
        sa.Column("service_permissions", postgresql.JSONB, nullable=False, server_default="{}"),
    )

    # 2. Rebuild credential_vault with encryption columns
    #    Drop old vault_path column, add encrypted_data, nonce, wrapped_dek, algorithm
    op.drop_column("credential_vault", "vault_path")
    op.add_column("credential_vault", sa.Column("encrypted_data", sa.Text, nullable=False, server_default=""))
    op.add_column("credential_vault", sa.Column("nonce", sa.Text, nullable=False, server_default=""))
    op.add_column("credential_vault", sa.Column("wrapped_dek", sa.Text, nullable=False, server_default=""))
    op.add_column("credential_vault", sa.Column("algorithm", sa.String(50), nullable=False, server_default="AES-256-GCM"))


def downgrade() -> None:
    op.drop_column("credential_vault", "algorithm")
    op.drop_column("credential_vault", "wrapped_dek")
    op.drop_column("credential_vault", "nonce")
    op.drop_column("credential_vault", "encrypted_data")
    op.add_column("credential_vault", sa.Column("vault_path", sa.String(500), nullable=False, server_default=""))
    op.drop_column("members", "service_permissions")
