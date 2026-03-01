-- Add instance-specific configuration fields to handle multi-instance deployments
-- These allow each instance to override environment variables via the database

ALTER TABLE "Config" ADD COLUMN "ticketPortalUrl" TEXT;

ALTER TABLE "Config" ADD COLUMN "ms_graph_client_id" TEXT;

ALTER TABLE "Config" ADD COLUMN "ms_graph_client_secret" TEXT;

ALTER TABLE "Config" ADD COLUMN "ms_graph_tenant_id" TEXT;

-- Add comment for clarity
COMMENT ON COLUMN "Config"."ticketPortalUrl" IS 'Instance-specific ticket portal base URL (e.g., https://rental.example.com/portal), overrides BASE_URL environment variable';

COMMENT ON COLUMN "Config"."ms_graph_client_id" IS 'Microsoft Graph Client ID for this instance, overrides MS_GRAPH_CLIENT_ID environment variable';

COMMENT ON COLUMN "Config"."ms_graph_client_secret" IS 'Microsoft Graph Client Secret for this instance, overrides MS_GRAPH_CLIENT_SECRET environment variable';

COMMENT ON COLUMN "Config"."ms_graph_tenant_id" IS 'Microsoft Graph Tenant ID for this instance, overrides MS_GRAPH_TENANT_ID environment variable';
