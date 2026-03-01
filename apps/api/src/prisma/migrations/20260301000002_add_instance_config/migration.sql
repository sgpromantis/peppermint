-- Add instance-specific configuration fields for multi-instance deployments
ALTER TABLE "Config" ADD COLUMN "ticketPortalUrl" TEXT;
ALTER TABLE "Config" ADD COLUMN "ms_graph_client_id" TEXT;
ALTER TABLE "Config" ADD COLUMN "ms_graph_client_secret" TEXT;
ALTER TABLE "Config" ADD COLUMN "ms_graph_tenant_id" TEXT;
