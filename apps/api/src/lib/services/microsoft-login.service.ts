import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Issuer } from "openid-client";
import { prisma } from "../../prisma";
import { InstanceConfigService } from "./instance-config.service";
import { MicrosoftGraphService } from "./microsoft-graph.service";
import { EncryptionService } from "./encryption.service";

interface AzureAdConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface AzureAdUserInfo {
  oid: string;
  email: string;
  name: string;
  displayName: string;
}

export class MicrosoftLoginService {
  private static oidcClient: any = null;
  private static oidcIssuer: string | null = null;

  /**
   * Get Azure AD configuration from database
   * Priority: Instance Config > Environment Variables
   */
  static async getConfig(): Promise<AzureAdConfig | null> {
    // Get from instance config (has Microsoft Graph credentials)
    const graphConfig = await InstanceConfigService.getMicrosoftGraphConfig();
    
    if (!graphConfig) {
      return null;
    }

    // Azure AD redirect URI should be configured separately
    const azureAdConfig = await prisma.config.findFirst();
    const azureAdRedirectUri = (azureAdConfig?.microsoft_ad_redirect_uri as string) || 
      `${process.env.REDIRECT_URI || "http://localhost:3000"}/auth/microsoft/callback`;

    return {
      clientId: graphConfig.clientId,
      clientSecret: graphConfig.clientSecret,
      tenantId: graphConfig.tenantId,
      redirectUri: azureAdRedirectUri,
    };
  }

  /**
   * Check if Azure AD is configured
   */
  static async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config;
  }

  /**
   * Initialize OIDC client for Azure AD
   */
  static async getOidcClient() {
    const config = await this.getConfig();
    if (!config) {
      throw new Error("Azure AD not configured");
    }

    // Reset if tenant changed
    if (this.oidcIssuer !== config.tenantId) {
      this.oidcClient = null;
      this.oidcIssuer = null;
    }

    if (!this.oidcClient) {
      const issuer = await Issuer.discover(
        `https://login.microsoftonline.com/${config.tenantId}/v2.0`
      );

      this.oidcClient = new issuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [config.redirectUri],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_basic",
      });

      this.oidcIssuer = config.tenantId;
    }

    return this.oidcClient;
  }

  /**
   * Generate Microsoft 365 login authorization URL
   */
  static async getAuthorizationUrl(state: string): Promise<string> {
    const client = await this.getOidcClient();
    const config = await this.getConfig();

    if (!config) {
      throw new Error("Azure AD not configured");
    }

    const url = client.authorizationUrl({
      scope: "openid profile email",
      response_type: "code",
      redirect_uri: config.redirectUri,
      state: state,
    });

    return url;
  }

  /**
   * Handle OAuth callback and get user info
   */
  static async handleCallback(code: string, state: string): Promise<AzureAdUserInfo> {
    const client = await this.getOidcClient();
    const config = await this.getConfig();

    if (!config) {
      throw new Error("Azure AD not configured");
    }

    // Exchange code for tokens
    // openid-client v5 requires checks.state when state is in params
    const tokenSet = await client.callback(config.redirectUri, { code, state }, { state });

    // Get user info from token
    const userInfo = await client.userinfo(tokenSet.access_token);

    return {
      oid: userInfo.oid as string, // Azure object ID
      email: userInfo.email as string,
      name: userInfo.name as string,
      displayName: userInfo.preferred_username as string,
    };
  }

  /**
   * Get user groups from Microsoft Graph for role assignment
   * Uses /users/{id}/memberOf with app token (client_credentials)
   */
  static async getUserGroups(userAzureId: string): Promise<string[]> {
    try {
      const token = await MicrosoftGraphService.getAccessToken();
      
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${userAzureId}/memberOf/microsoft.graph.group`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return response.data.value.map((group: any) => group.id);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      return [];
    }
  }

  /**
   * Auto-login or create user from Azure AD
   * Links with existing synced user if available
   */
  static async loginOrCreateUser(userInfo: AzureAdUserInfo): Promise<any> {
    const email = userInfo.email.toLowerCase();

    // Try to find existing user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update Microsoft user ID if not set
      if (!user.microsoftAzureId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            microsoftAzureId: userInfo.oid,
          },
        });
      }
      return user;
    }

    // User doesn't exist - create new account
    // Generate random password (they'll use SSO)
    const randomPassword = crypto.randomBytes(32).toString("hex");

    user = await prisma.user.create({
      data: {
        email,
        name: userInfo.name || userInfo.displayName || email.split("@")[0],
        password: await bcrypt.hash(randomPassword, 10),
        isAdmin: false,
        isManager: false,
        external_user: false,
        microsoftAzureId: userInfo.oid,
        firstLogin: true,
        language: "en",
      },
    });

    // Apply group-based roles if configured
    try {
      const groupMapping = await MicrosoftGraphService.getGroupRoleMapping();
      const userGroups = await this.getUserGroups(userInfo.oid);

      // Check if user is in admin group
      if (groupMapping?.adminsGroupId && userGroups.includes(groupMapping.adminsGroupId)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isAdmin: true },
        });
        user.isAdmin = true;
      }

      // Check if user is in manager group
      if (groupMapping?.managersGroupId && userGroups.includes(groupMapping.managersGroupId)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isManager: true },
        });
        user.isManager = true;
      }
    } catch (error) {
      console.error("Error applying group-based roles:", error);
    }

    return user;
  }

  /**
   * Clear cached OIDC client (for testing/key rotation)
   */
  static clearCache() {
    this.oidcClient = null;
    this.oidcIssuer = null;
  }
}
