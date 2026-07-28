-- RLS policies for Media Basket
-- These are applied by the Alembic migration, but kept here as reference

-- Enable RLS on all org-scoped tables
ALTER TABLE service_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY org_isolation ON service_instances
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON credential_vault
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON content_items
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON content_metadata
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON moderation_actions
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON audit_log
    USING (org_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY org_isolation ON billing_plans
    USING (org_id = current_setting('app.current_tenant')::UUID);

-- Usage: SET LOCAL app.current_tenant = '<org-uuid>';
