import { prisma } from "../../prisma";
import { EncryptionService } from "./encryption.service";

/**
 * Instance configuration service
 * 
 * Provides database-first configuration for multi-instance deployments.
 * Allows each instance to override environment variables via the database.
 * 
 * Priority order:
 * 1. Database config (highest priority - allows per-instance override)
 * 2. Environment variables (fallback for backward compatibility)
 * 3. Default values (lowest priority)
 */
export class InstanceConfigService {
  /**
   * Get the ticket portal base URL for this instance
   * Used to generate links in email templates
   * 
   * @returns Base URL for ticket portal (e.g., "https://rental.example.com/portal")
   */
  static async getTicketPortalUrl(): Promise<string> {
    try {
      const config = await prisma.config.findFirst();
      
      // 1. Try database config first
      if (config?.ticketPortalUrl) {
        return config.ticketPortalUrl;
      }
    } catch (error) {
      console.error("Error fetching instance config from database:", error);
    }

    // 2. Fall back to environment variables
    if (process.env.BASE_URL) {
      return process.env.BASE_URL;
    }

    if (process.env.NEXT_PUBLIC_URL) {
      return process.env.NEXT_PUBLIC_URL;
    }

    // 3. Default fallback
    return "http://localhost:3000";
  }

  /**
   * Get Microsoft Graph configuration for this instance
   * Automatically decrypts credentials stored in database
   * 
   * @returns Object with clientId, clientSecret, and tenantId
   */
  static async getMicrosoftGraphConfig() {
    try {
      const config = await prisma.config.findFirst();

      // 1. Try database config first (instance-specific, decrypted)
      if (
        config?.ms_graph_client_id &&
        config?.ms_graph_client_secret &&
        config?.ms_graph_tenant_id
      ) {
        // Decrypt credentials from database
        const clientId = await EncryptionService.decrypt(config.ms_graph_client_id);
        const clientSecret = await EncryptionService.decrypt(config.ms_graph_client_secret);
        const tenantId = await EncryptionService.decrypt(config.ms_graph_tenant_id);

        return {
          clientId,
          clientSecret,
          tenantId,
        };
      }
    } catch (error) {
      console.error("Error fetching Microsoft Graph config from database:", error);
    }

    // 2. Fall back to environment variables
    if (
      process.env.MS_GRAPH_CLIENT_ID &&
      process.env.MS_GRAPH_CLIENT_SECRET &&
      process.env.MS_GRAPH_TENANT_ID
    ) {
      return {
        clientId: process.env.MS_GRAPH_CLIENT_ID,
        clientSecret: process.env.MS_GRAPH_CLIENT_SECRET,
        tenantId: process.env.MS_GRAPH_TENANT_ID,
      };
    }

    // 3. No config found
    return null;
  }

  /**
   * Update instance configuration
   * Automatically encrypts sensitive credentials before storing in database
   * Used by admin API to save configuration changes
   */
  static async updateConfig(updates: {
    ticketPortalUrl?: string;
    ms_graph_client_id?: string;
    ms_graph_client_secret?: string;
    ms_graph_tenant_id?: string;
  }) {
    // Encrypt sensitive credentials
    const encryptedUpdates: any = { ...updates };

    if (updates.ms_graph_client_id) {
      encryptedUpdates.ms_graph_client_id = await EncryptionService.encrypt(updates.ms_graph_client_id);
    }

    if (updates.ms_graph_client_secret) {
      encryptedUpdates.ms_graph_client_secret = await EncryptionService.encrypt(updates.ms_graph_client_secret);
    }

    if (updates.ms_graph_tenant_id) {
      encryptedUpdates.ms_graph_tenant_id = await EncryptionService.encrypt(updates.ms_graph_tenant_id);
    }

    const config = await prisma.config.findFirst();

    if (!config) {
      // Create if doesn't exist
      return prisma.config.create({
        data: {
          ...encryptedUpdates,
        },
      });
    }

    // Update existing
    return prisma.config.update({
      where: { id: config.id },
      data: encryptedUpdates,
    });
  }
}
