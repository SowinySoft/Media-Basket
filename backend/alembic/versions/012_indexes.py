"""Performance: add missing database indexes

Revision ID: 012_indexes
Revises: 011_workflows
Create Date: 2026-07-31
"""
from alembic import op

revision = "012_indexes"
down_revision = "011_workflows"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Content items — most queried table
    op.create_index("ix_content_items_org_id_ingested", "content_items", ["org_id", "ingested_at"])
    op.create_index("ix_content_items_service_instance_id", "content_items", ["service_instance_id"])
    op.create_index("ix_content_items_content_type", "content_items", ["content_type"])

    # Content metadata
    op.create_index("ix_content_metadata_content_item_id", "content_metadata", ["content_item_id"])

    # Service instances
    op.create_index("ix_service_instances_org_id", "service_instances", ["org_id"])

    # Members
    op.create_index("ix_members_org_id", "members", ["org_id"])
    op.create_index("ix_members_user_id", "members", ["user_id"])

    # Audit log
    op.create_index("ix_audit_log_org_id_timestamp", "audit_log", ["org_id", "timestamp"])

    # Moderation actions
    op.create_index("ix_moderation_actions_org_id", "moderation_actions", ["org_id"])
    op.create_index("ix_moderation_actions_content_item_id", "moderation_actions", ["content_item_id"])

    # Notifications
    op.create_index("ix_notifications_org_id_created", "notifications", ["org_id", "created_at"])

    # Tasks
    op.create_index("ix_tasks_org_id", "tasks", ["org_id"])

    # Activity log
    op.create_index("ix_activity_log_org_id", "activity_log", ["org_id"])

    # Scheduled posts
    op.create_index("ix_scheduled_posts_org_id_status", "scheduled_posts", ["org_id", "status"])
    op.create_index("ix_scheduled_posts_scheduled_at", "scheduled_posts", ["scheduled_at"])

    # Alerts
    op.create_index("ix_alerts_org_id", "alerts", ["org_id"])

    # Workflows
    op.create_index("ix_workflows_org_id_enabled", "workflows", ["org_id", "enabled"])


def downgrade() -> None:
    indexes = [
        ("ix_workflows_org_id_enabled", "workflows"),
        ("ix_alerts_org_id", "alerts"),
        ("ix_scheduled_posts_scheduled_at", "scheduled_posts"),
        ("ix_scheduled_posts_org_id_status", "scheduled_posts"),
        ("ix_activity_log_org_id", "activity_log"),
        ("ix_tasks_org_id", "tasks"),
        ("ix_notifications_org_id_created", "notifications"),
        ("ix_moderation_actions_content_item_id", "moderation_actions"),
        ("ix_moderation_actions_org_id", "moderation_actions"),
        ("ix_audit_log_org_id_timestamp", "audit_log"),
        ("ix_members_user_id", "members"),
        ("ix_members_org_id", "members"),
        ("ix_service_instances_org_id", "service_instances"),
        ("ix_content_metadata_content_item_id", "content_metadata"),
        ("ix_content_items_content_type", "content_items"),
        ("ix_content_items_service_instance_id", "content_items"),
        ("ix_content_items_org_id_ingested", "content_items"),
    ]
    for name, table in indexes:
        op.drop_index(name, table_name=table)
