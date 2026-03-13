import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../../prisma";
import { InstanceConfigService } from "./instance-config.service";
import { EncryptionService } from "./encryption.service";

interface MicrosoftGraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface GraphGroup {
  id: string;
  displayName: string;
  description: string | null;
  mail: string | null;
  memberCount?: number;
}

interface GroupRoleMapping {
  usersGroupId?: string;
  usersGroupName?: string;
  managersGroupId?: string;
  managersGroupName?: string;
  adminsGroupId?: string;
  adminsGroupName?: string;
}

export class MicrosoftGraphService {
  private static accessToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Get Microsoft Graph configuration from database
   * Priority: Instance Config > OAuth Provider > Environment Variables
   */
  static async getConfig(): Promise<MicrosoftGraphConfig | null> {
    // 1. Try instance-specific config first (database-first approach)
    const instanceConfig = await InstanceConfigService.getMicrosoftGraphConfig();
    if (instanceConfig) {
      return instanceConfig;
    }

    // 2. Try to get from OAuth provider configured for Microsoft (legacy support)
    const oauthProvider = await prisma.oAuthProvider.findFirst({
      where: {
        name: { contains: "microsoft", mode: "insensitive" },
      },
    });

    if (oauthProvider) {
      // Extract tenantId from authorizationUrl if present
      const tenantMatch = oauthProvider.authorizationUrl.match(
        /login\.microsoftonline\.com\/([^/]+)/
      );
      const tenantId = tenantMatch ? tenantMatch[1] : "common";

      // Decrypt sensitive credentials
      const decryptedSecret = await EncryptionService.decrypt(oauthProvider.clientSecret);

      return {
        clientId: oauthProvider.clientId,
        clientSecret: decryptedSecret,
        tenantId,
      };
    }

    // 3. Config not found
    return null;
  }

  /**
   * Get access token for Microsoft Graph API
   */
  static async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const config = await this.getConfig();
    if (!config) {
      throw new Error("Microsoft Graph not configured");
    }

    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append("client_id", config.clientId);
    params.append("client_secret", config.clientSecret);
    params.append("scope", "https://graph.microsoft.com/.default");
    params.append("grant_type", "client_credentials");

    const response = await axios.post(tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = response.data.access_token as string;
    this.accessToken = token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = new Date(
      Date.now() + (response.data.expires_in - 300) * 1000
    );

    return token;
  }

  /**
   * Helper: follow @odata.nextLink to fetch all pages
   */
  private static async fetchAllPages<T>(initialUrl: string, token: string): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = initialUrl;

    while (url) {
      const response: { data: { value?: T[]; "@odata.nextLink"?: string } } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      results.push(...(response.data.value || []));
      url = response.data["@odata.nextLink"] || null;
    }

    return results;
  }

  /**
   * List users from Azure AD (with pagination)
   */
  static async listUsers(
    filter?: string
  ): Promise<GraphUser[]> {
    const token = await this.getAccessToken();

    let url = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999";
    if (filter) {
      url += `&$filter=${encodeURIComponent(filter)}`;
    }

    return this.fetchAllPages<GraphUser>(url, token);
  }

  /**
   * Get a specific user by email
   */
  static async getUserByEmail(email: string): Promise<GraphUser | null> {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users?$filter=mail eq '${email}' or userPrincipalName eq '${email}'&$select=id,displayName,mail,userPrincipalName`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data.value[0] || null;
    } catch (error) {
      console.error("Error fetching user from Microsoft Graph:", error);
      return null;
    }
  }

  /**
   * Sync users from Azure AD to the helpdesk
   * Creates users that exist in Azure AD but not in the system
   */
  static async syncUsers(options?: {
    filter?: string;
    createAsAdmin?: boolean;
    createAsManager?: boolean;
  }): Promise<{ created: number; existing: number; errors: string[] }> {
    const result = { created: 0, existing: 0, errors: [] as string[] };

    try {
      const graphUsers = await this.listUsers(options?.filter);

      for (const graphUser of graphUsers) {
        const email = graphUser.mail || graphUser.userPrincipalName;
        if (!email) continue;

        try {
          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            result.existing++;
            continue;
          }

          // Create new user with random password (they'll use SSO)
          const bcrypt = require("bcrypt");
          const randomPassword = require("crypto").randomBytes(32).toString("hex");

          await prisma.user.create({
            data: {
              email,
              name: graphUser.displayName || email.split("@")[0],
              password: await bcrypt.hash(randomPassword, 10),
              isAdmin: options?.createAsAdmin || false,
              external_user: false,
            },
          });

          result.created++;
        } catch (error: any) {
          result.errors.push(`Failed to create user ${email}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Failed to list users: ${error.message}`);
    }

    return result;
  }

  /**
   * Create a single user from Azure AD
   */
  static async createUserFromAzureAD(
    email: string,
    options?: { isAdmin?: boolean; isManager?: boolean }
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Check if user already exists locally
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return { success: true, user: existingUser };
      }

      // Fetch user from Azure AD
      const graphUser = await this.getUserByEmail(email);
      if (!graphUser) {
        return { success: false, error: "User not found in Azure AD" };
      }

      // Create user
      const bcrypt = require("bcrypt");
      const randomPassword = require("crypto").randomBytes(32).toString("hex");

      const newUser = await prisma.user.create({
        data: {
          email: graphUser.mail || graphUser.userPrincipalName,
          name: graphUser.displayName || email.split("@")[0],
          password: await bcrypt.hash(randomPassword, 10),
          isAdmin: options?.isAdmin || false,
          external_user: false,
        },
      });

      return { success: true, user: newUser };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if Microsoft Graph is configured
   */
  static async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return config !== null;
  }

  /**
   * List all Microsoft 365 groups (with pagination - fetches ALL groups)
   */
  static async listGroups(): Promise<GraphGroup[]> {
    const token = await this.getAccessToken();
    const url = "https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,mail&$top=999";
    return this.fetchAllPages<GraphGroup>(url, token);
  }

  /**
   * Search groups by displayName or mail (for combobox search)
   */
  static async searchGroups(query: string): Promise<GraphGroup[]> {
    const token = await this.getAccessToken();
    const filter = `startswith(displayName,'${query.replace(/'/g, "''")}') or startswith(mail,'${query.replace(/'/g, "''")}')`;    const url = `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,mail&$top=50&$filter=${encodeURIComponent(filter)}`;
    try {
      return this.fetchAllPages<GraphGroup>(url, token);
    } catch (error) {
      // If filter fails, fall back to client-side filtering
      console.error("Group search filter failed, falling back to full list:", error);
      const allGroups = await this.listGroups();
      const lowerQuery = query.toLowerCase();
      return allGroups.filter(
        (g) =>
          g.displayName?.toLowerCase().includes(lowerQuery) ||
          g.mail?.toLowerCase().includes(lowerQuery)
      );
    }
  }

  /**
   * Get members of a specific group (with pagination)
   */
  static async getGroupMembers(groupId: string): Promise<GraphUser[]> {
    const token = await this.getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName&$top=999`;
    const allMembers = await this.fetchAllPages<any>(url, token);

    // Filter to only users (not nested groups or other object types)
    return allMembers.filter(
      (member: any) => member["@odata.type"] === "#microsoft.graph.user"
    );
  }

  /**
   * Get group by ID
   */
  static async getGroupById(groupId: string): Promise<GraphGroup | null> {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/groups/${groupId}?$select=id,displayName,description,mail`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    } catch (error) {
      console.error("Error fetching group:", error);
      return null;
    }
  }

  /**
   * Save group-to-role mapping configuration
   */
  static async saveGroupRoleMapping(mapping: GroupRoleMapping): Promise<void> {
    const config = await prisma.config.findFirst();
    
    if (!config) {
      throw new Error("Config not found");
    }

    // Store the mapping in the notifications JSON field (reusing existing JSON field)
    // Or we can add a new column - for now let's use a simple approach with env-like storage
    const existingNotifications = (config.notifications as any) || {};
    
    await prisma.config.update({
      where: { id: config.id },
      data: {
        notifications: {
          ...existingNotifications,
          msGraphGroupMapping: mapping,
        },
      },
    });
  }

  /**
   * Get group-to-role mapping configuration
   */
  static async getGroupRoleMapping(): Promise<GroupRoleMapping | null> {
    const config = await prisma.config.findFirst();
    
    if (!config?.notifications) {
      return null;
    }

    const notifications = config.notifications as any;
    return notifications.msGraphGroupMapping || null;
  }

  /**
   * Sync users from Microsoft 365 groups based on role mapping
   */
  static async syncUsersFromGroups(): Promise<{
    users: { created: number; existing: number; updated: number };
    managers: { created: number; existing: number; updated: number };
    admins: { created: number; existing: number; updated: number };
    errors: string[];
  }> {
    const result = {
      users: { created: 0, existing: 0, updated: 0 },
      managers: { created: 0, existing: 0, updated: 0 },
      admins: { created: 0, existing: 0, updated: 0 },
      errors: [] as string[],
    };

    const mapping = await this.getGroupRoleMapping();
    if (!mapping) {
      result.errors.push("No group-role mapping configured");
      return result;
    }

    // Helper function to sync a group with a specific role
    const syncGroup = async (
      groupId: string | undefined,
      role: "users" | "managers" | "admins"
    ) => {
      if (!groupId) return;

      try {
        const members = await this.getGroupMembers(groupId);

        for (const member of members) {
          const email = member.mail || member.userPrincipalName;
          if (!email) continue;

          try {
            // Use raw SQL to check for existing user to avoid Prisma schema mismatch
            const existingUsers = (await prisma.$queryRawUnsafe(
              `SELECT id, email, name, "isAdmin" FROM "User" WHERE email = $1`,
              email
            )) as any[];
            const existingUser = existingUsers[0];

            const isAdmin = role === "admins";
            const isManager = role === "managers" || role === "admins";

            if (existingUser) {
              // Update role if needed using raw SQL
              // Check if isManager column exists
              try {
                await prisma.$executeRawUnsafe(
                  `UPDATE "User" SET "isAdmin" = $1, "isManager" = $2, name = $3 WHERE email = $4`,
                  isAdmin,
                  isManager,
                  member.displayName || existingUser.name,
                  email
                );
              } catch {
                // isManager column doesn't exist, update without it
                await prisma.$executeRawUnsafe(
                  `UPDATE "User" SET "isAdmin" = $1, name = $2 WHERE email = $3`,
                  isAdmin,
                  member.displayName || existingUser.name,
                  email
                );
              }
              result[role].updated++;
            } else {
              // Create new user using raw SQL
              const randomPassword = crypto.randomBytes(32).toString("hex");
              const hashedPassword = await bcrypt.hash(randomPassword, 10);
              const name = member.displayName || email.split("@")[0];

              // Try with isManager column first
              try {
                await prisma.$executeRawUnsafe(
                  `INSERT INTO "User" (id, email, name, password, "isAdmin", "isManager", external_user, "language", "createdAt", "updatedAt") 
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, 'de', NOW(), NOW())`,
                  email,
                  name,
                  hashedPassword,
                  isAdmin,
                  isManager
                );
              } catch {
                // isManager column doesn't exist
                await prisma.$executeRawUnsafe(
                  `INSERT INTO "User" (id, email, name, password, "isAdmin", external_user, "language", "createdAt", "updatedAt") 
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, false, 'de', NOW(), NOW())`,
                  email,
                  name,
                  hashedPassword,
                  isAdmin
                );
              }
              result[role].created++;
            }
          } catch (error: any) {
            result.errors.push(
              `Failed to sync user ${email}: ${error.message}`
            );
          }
        }
      } catch (error: any) {
        result.errors.push(
          `Failed to get members of group ${groupId}: ${error.message}`
        );
      }
    };

    // Sync admins first (highest privilege)
    await syncGroup(mapping.adminsGroupId, "admins");
    // Then managers
    await syncGroup(mapping.managersGroupId, "managers");
    // Then regular users
    await syncGroup(mapping.usersGroupId, "users");

    return result;
  }

  /**
   * Preview sync - show what would be created/updated without making changes
   */
  static async previewSync(): Promise<{
    users: { toCreate: string[]; existing: string[] };
    managers: { toCreate: string[]; existing: string[] };
    admins: { toCreate: string[]; existing: string[] };
    errors: string[];
  }> {
    const result = {
      users: { toCreate: [] as string[], existing: [] as string[] },
      managers: { toCreate: [] as string[], existing: [] as string[] },
      admins: { toCreate: [] as string[], existing: [] as string[] },
      errors: [] as string[],
    };

    const mapping = await this.getGroupRoleMapping();
    if (!mapping) {
      result.errors.push("No group-role mapping configured");
      return result;
    }

    const previewGroup = async (
      groupId: string | undefined,
      role: "users" | "managers" | "admins"
    ) => {
      if (!groupId) return;

      try {
        const members = await this.getGroupMembers(groupId);

        for (const member of members) {
          const email = member.mail || member.userPrincipalName;
          if (!email) continue;

          // Use raw SQL to avoid Prisma schema mismatch
          const existingUsers = (await prisma.$queryRawUnsafe(
            `SELECT id FROM "User" WHERE email = $1`,
            email
          )) as any[];

          if (existingUsers.length > 0) {
            result[role].existing.push(email);
          } else {
            result[role].toCreate.push(email);
          }
        }
      } catch (error: any) {
        result.errors.push(
          `Failed to preview group ${groupId}: ${error.message}`
        );
      }
    };

    await previewGroup(mapping.adminsGroupId, "admins");
    await previewGroup(mapping.managersGroupId, "managers");
    await previewGroup(mapping.usersGroupId, "users");

    return result;
  }
}
