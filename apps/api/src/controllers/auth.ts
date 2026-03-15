import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { LRUCache } from "lru-cache";
import { generators } from "openid-client";
import { AuthorizationCode } from "simple-oauth2";
import { getOAuthProvider, getOidcConfig, getAzureAdConfig, isAzureAdConfigured } from "../lib/auth";
import { track } from "../lib/hog";
import { forgotPassword } from "../lib/nodemailer/auth/forgot-password";
import { metrics } from "../lib/prometheus-metrics";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { getOAuthClient } from "../lib/utils/oauth_client";
import { getOidcClient } from "../lib/utils/oidc_client";
import { MicrosoftLoginService } from "../lib/services/microsoft-login.service";
import { prisma } from "../prisma";

const options = {
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 5, // Items expire after 5 minutes
};

const cache = new LRUCache(options);

async function getUserEmails(token: string) {
  const res = await axios.get("https://api.github.com/user/emails", {
    headers: {
      Authorization: `token ${token}`,
    },
  });

  // Return only the primary email address
  const primaryEmail = res.data.find(
    (email: { primary: boolean }) => email.primary
  );
  return primaryEmail ? primaryEmail.email : null; // Return the email or null if not found
}

function generateRandomPassword(length: number): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

async function tracking(event: string, properties: any) {
  const client = track();

  client.capture({
    event: event,
    properties: properties,
    distinctId: "uuid",
  });
}

export function authRoutes(fastify: FastifyInstance) {
  // Register a new user
  fastify.post(
    "/api/v1/auth/user/register",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            admin: { type: "boolean" },
            manager: { type: "boolean" },
            name: { type: "string" },
          },
          required: ["email", "password", "name", "admin"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { email, password, admin, manager, name } = request.body as {
        email: string;
        password: string;
        admin: boolean;
        manager: boolean;
        name: string;
      };

      const requester = await checkSession(request);

      if (!requester?.isAdmin) {
        return reply.code(401).send({
          message: "Unauthorized",
        });
      }

      // Checks if email already exists
      let record = await prisma.user.findUnique({
        where: { email },
      });

      // if exists, return 400
      if (record) {
        return reply.code(400).send({
          message: "Email already exists",
        });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 10),
          name,
          isAdmin: admin,
          isManager: manager || false,
        },
      });

      const hog = track();

      hog.capture({
        event: "user_registered",
        distinctId: user.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  // Register a new external user
  // SECURITY: Disabled by default - users must be created by admin or synced from Microsoft 365
  fastify.post(
    "/api/v1/auth/user/register/external",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            name: { type: "string" },
            language: { type: "string" },
          },
          required: ["email", "password", "name"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check if external registration is enabled via config
      const config = await prisma.config.findFirst();
      const notifications = (config?.notifications as any) || {};
      const allowExternalRegistration = notifications.allowExternalRegistration === true;

      if (!allowExternalRegistration) {
        return reply.code(403).send({
          success: false,
          message: "Registrierung deaktiviert. Bitte kontaktieren Sie den Administrator.",
        });
      }

      let { email, password, name, language } = request.body as {
        email: string;
        password: string;
        name: string;
        language: string;
      };

      // Checks if email already exists
      let record = await prisma.user.findUnique({
        where: { email },
      });

      // if exists, return 400
      if (record) {
        return reply.code(400).send({
          message: "Email already exists",
        });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 10),
          name,
          isAdmin: false,
          language,
          external_user: true,
          firstLogin: false,
        },
      });

      const hog = track();

      hog.capture({
        event: "user_registered_external",
        distinctId: user.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  // Forgot password & generate code
  fastify.post(
    "/api/v1/auth/password-reset",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email, link } = request.body as { email: string; link: string };

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.code(401).send({
          message: "Invalid email",
          success: false,
        });
      }

      function generateRandomCode(length = 6) {
        const min = Math.pow(10, length - 1); // Minimum number for the given length
        const max = Math.pow(10, length) - 1; // Maximum number for the given length
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      const code = generateRandomCode();

      const uuid = await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          code: String(code),
        },
      });

      forgotPassword(email, String(code), link, uuid.id);

      reply.send({
        success: true,
      });
    }
  );

  // Check code & uuid us valid
  fastify.post(
    "/api/v1/auth/password-reset/code",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, uuid } = request.body as { code: string; uuid: string };

      const reset = await prisma.passwordResetToken.findUnique({
        where: { code: code, id: uuid },
      });

      if (!reset) {
        reply.code(401).send({
          message: "Invalid Code",
          success: false,
        });
      } else {
        reply.send({
          success: true,
        });
      }
    }
  );

  // Reset users password via code
  fastify.post(
    "/api/v1/auth/password-reset/password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { password, code } = request.body as {
        password: string;
        code: string;
      };

      const user = await prisma.passwordResetToken.findUnique({
        where: { code: code },
      });

      if (!user) {
        return reply.code(401).send({
          message: "Invalid Code",
          success: false,
        });
      }

      await prisma.user.update({
        where: { id: user!.userId },
        data: {
          password: await bcrypt.hash(password, 10),
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // User password login route
  fastify.post(
    "/api/v1/auth/login",
    {
      schema: {
        body: {
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        let { email, password } = request.body as {
          email: string;
          password: string;
        };

        // Use $queryRawUnsafe to avoid Prisma schema/DB mismatch issues
        const users: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "User" WHERE email = $1 LIMIT 1`,
          email
        );
        
        const user = users[0];

        if (!user?.password) {
          metrics.incrementFailedLogins();
          return reply.code(401).send({
            message: "Invalid email or password",
          });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          metrics.incrementFailedLogins();
          return reply.code(401).send({
            message: "Invalid email or password",
          });
        }

        // Generate a secure session token
        var secret = Buffer.from(process.env.SECRET!, "base64");
        const token = jwt.sign(
          {
            data: {
              id: user.id,
              // Add a unique identifier for this session
              sessionId: crypto.randomBytes(32).toString("hex"),
            },
          },
          secret,
          {
            expiresIn: "8h",
            algorithm: "HS256",
          }
        );

        // Store session with additional security info
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: token,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
            userAgent: request.headers["user-agent"] || "",
            ipAddress: request.ip,
          },
        });

        await tracking("user_logged_in_password", {});
        
        // Track login metrics
        metrics.incrementLogins("password");

        const data = {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          isManager: user.isManager ?? false,
          language: user.language,
          ticket_created: user.notify_ticket_created,
          ticket_status_changed: user.notify_ticket_status_changed,
          ticket_comments: user.notify_ticket_comments,
          ticket_assigned: user.notify_ticket_assigned,
          firstLogin: user.firstLogin,
          external_user: user.external_user,
        };

        reply.send({
          token,
          user: data,
        });
      } catch (error: any) {
        metrics.incrementFailedLogins();
        console.error("Login error:", error?.message || error);
        console.error("Stack:", error?.stack);
        return reply.code(500).send({
          message: "Datenbankverbindungsfehler. Bitte versuchen Sie es später erneut.",
          success: false,
        });
      }
    }
  );

  // Checks if a user is password auth or other
  fastify.get(
    "/api/v1/auth/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authtype = await prisma.config.findMany({
        where: {
          sso_active: true,
        },
      });

      if (authtype.length === 0) {
        return reply.code(200).send({
          success: true,
          message: "SSO not enabled",
          oauth: false,
        });
      }

      const provider = authtype[0].sso_provider;
      const sso_active = authtype[0].sso_active;

      if (!sso_active) {
        return reply.code(200).send({
          success: true,
          message: "SSO not enabled",
          oauth: false,
        });
      }

      // Find out which config type it is, then action accordinly
      switch (provider) {
        case "oidc":
          const config = await getOidcConfig();
          if (!config) {
            return reply
              .code(500)
              .send({ error: "OIDC configuration not found" });
          }

          const oidcClient = await getOidcClient(config);

          // Generate codeVerifier and codeChallenge
          const codeVerifier = generators.codeVerifier();
          const codeChallenge = generators.codeChallenge(codeVerifier);

          // Generate a random state parameter
          const state = generators.state();

          // Store codeVerifier in cache with s
          cache.set(state, {
            codeVerifier: codeVerifier,
          });

          // Generate authorization URL
          const url = oidcClient.authorizationUrl({
            scope: "openid email profile",
            response_type: "code",
            redirect_uri: config.redirectUri,
            code_challenge: codeChallenge,
            code_challenge_method: "S256", // Use 'plain' if 'S256' is not supported
            state: state,
          });

          reply.send({
            type: "oidc",
            success: true,
            url: url,
          });

          break;
        case "oauth":
          const oauthProvider = await getOAuthProvider();

          if (!oauthProvider) {
            return reply.code(500).send({
              error: `OAuth provider ${provider} configuration not found`,
            });
          }

          const client = getOAuthClient({
            ...oauthProvider,
            name: oauthProvider.name,
          });

          // Generate authorization URL
          const uri = client.authorizeURL({
            redirect_uri: oauthProvider.redirectUri,
            scope: oauthProvider.scope,
          });

          reply.send({
            type: "oauth",
            success: true,
            url: uri,
          });

          break;
        default:
          break;
      }
    }
  );

  // oidc api callback route
  fastify.get(
    "/api/v1/auth/oidc/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const oidc = await getOidcConfig();

        const config = await getOidcClient(oidc);
        if (!config) {
          return reply
            .code(500)
            .send({ error: "OIDC configuration not properly set" });
        }

        const oidcClient = await getOidcClient(config);

        // Parse the callback parameters
        const params = oidcClient.callbackParams(request.raw);

        if (params.iss === "undefined") {
          // Remove the trailing part and ensure a trailing slash
          params.iss = oidc.issuer.replace(
            /\/\.well-known\/openid-configuration$/,
            "/"
          );
        }

        // Retrieve the state parameter from the callback
        const state = params.state;

        const sessionData: any = cache.get(state);

        if (!sessionData) {
          return reply.status(400).send("Invalid or expired session");
        }

        const { codeVerifier } = sessionData;

        // Handle the case where codeVerifier is not found
        if (!codeVerifier) {
          return reply.status(400).send("Invalid or expired session");
        }

        let tokens = await oidcClient.callback(
          (
            await oidc
          ).redirectUri,
          params,
          {
            code_verifier: codeVerifier,
            state: state,
          }
        );

        // Clean up: Remove the codeVerifier from the cache
        cache.delete(state);

        // Retrieve user information
        const userInfo = await oidcClient.userinfo(tokens.access_token);

        let user = await prisma.user.findUnique({
          where: { email: userInfo.email },
        });

        await tracking("user_logged_in_oidc", {});

        if (!user) {
          // Create a new basic user
          user = await prisma.user.create({
            data: {
              email: userInfo.email,
              password: await bcrypt.hash(generateRandomPassword(12), 10), // Set a random password of length 12
              name: userInfo.name || "New User", // Use the name from userInfo or a default
              isAdmin: false, // Set isAdmin to false for basic users
              language: "de", // Set a default language
              external_user: false, // Mark as external user
              firstLogin: true, // Set firstLogin to true
            },
          });
        }

        var b64string = process.env.SECRET;
        var secret = new Buffer(b64string!, "base64"); // Ta-da

        // Issue JWT token
        let signed_token = jwt.sign(
          {
            data: { id: user.id },
          },
          secret,
          { expiresIn: "8h" }
        );

        // Create a session
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: signed_token,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        });

        // Send Response
        reply.send({
          token: signed_token,
          onboarding: user.firstLogin,
          success: true,
        });
      } catch (error: any) {
        console.error("Authentication error:", error);
        reply.status(403).send({
          success: false,
          error: "OIDC callback error",
          details: error.message,
        });
      }
    }
  );

  // oauth api callback route
  fastify.get(
    "/api/v1/auth/oauth/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code }: any = request.query;
      const oauthProvider = await getOAuthProvider();

      if (!oauthProvider) {
        return reply.code(500).send({
          error: `OAuth provider configuration not found`,
        });
      }

      const client = new AuthorizationCode({
        client: {
          id: oauthProvider.clientId,
          secret: oauthProvider.clientSecret,
        },
        auth: {
          tokenHost: oauthProvider.authorizationUrl,
        },
      });

      const tokenParams = {
        code,
        redirect_uri: oauthProvider.redirectUri,
      };

      try {
        // Exchange authorization code for an access token
        const fetch_token = await client.getToken(tokenParams);
        const access_token = fetch_token.token.access_token;

        // // Fetch user info from the provider
        const userInfoResponse: any = await axios.get(
          oauthProvider.userInfoUrl,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        );

        const emails =
          oauthProvider.name === "github"
            ? await getUserEmails(access_token as string)
            : userInfoResponse.email;

        // Issue JWT token
        let user = await prisma.user.findUnique({
          where: { email: emails },
        });

        if (!user) {
          return reply.send({
            success: false,
            message: "Invalid email",
          });
        }

        var b64string = process.env.SECRET;
        var secret = new Buffer(b64string!, "base64"); // Ta-da

        // Issue JWT token
        let signed_token = jwt.sign(
          {
            data: { id: user.id },
          },
          secret,
          { expiresIn: "8h" }
        );

        // Create a session
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: signed_token,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        });

        await tracking("user_logged_in_oauth", {});

        // Send Response
        reply.send({
          token: signed_token,
          onboarding: user.firstLogin,
          success: true,
        });
      } catch (error: any) {
        console.error("Authentication error:", error);
        reply.status(403).send({
          success: false,
          error: "OAuth callback error",
          details: error.message,
        });
      }
    }
  );

  // Microsoft 365 / Azure AD login - Get authorization URL
  fastify.get(
    "/api/v1/auth/microsoft/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const isConfigured = await isAzureAdConfigured();

        if (!isConfigured) {
          return reply.code(200).send({
            success: true,
            configured: false,
            message: "Azure AD not configured",
          });
        }

        // Generate state parameter
        const state = generators.state();

        // Store state in cache for validation on callback
        cache.set(state, {
          type: "microsoft",
          createdAt: Date.now(),
        });

        // Get the authorization URL from Microsoft Login Service
        const url = await MicrosoftLoginService.getAuthorizationUrl(state);

        reply.send({
          type: "microsoft",
          success: true,
          configured: true,
          url: url,
        });
      } catch (error: any) {
        console.error("Microsoft login check error:", error);
        reply.code(500).send({
          success: false,
          configured: false,
          error: error.message,
        });
      }
    }
  );

  // Microsoft 365 / Azure AD callback handler
  fastify.get(
    "/api/v1/auth/microsoft/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, state, error, error_description } = request.query as {
          code?: string;
          state?: string;
          error?: string;
          error_description?: string;
        };

        // Handle OAuth error from Azure AD
        if (error) {
          console.error("Azure AD error:", error, error_description);
          return reply.code(400).send({
            success: false,
            error: error,
            error_description: error_description,
          });
        }

        if (!code || !state) {
          return reply.code(400).send({
            success: false,
            error: "Missing required parameters",
          });
        }

        // Validate state parameter
        const sessionData = cache.get(state);
        if (!sessionData) {
          return reply.code(400).send({
            success: false,
            error: "Invalid or expired state parameter",
          });
        }

        // Clean up state from cache
        cache.delete(state);

        // Exchange code for token and get user info
        const userInfo = await MicrosoftLoginService.handleCallback(code, state);

        // Get or create user
        let user = await MicrosoftLoginService.loginOrCreateUser(userInfo);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { updatedAt: new Date() },
        });

        // Generate JWT token
        const b64string = process.env.SECRET;
        const secret = Buffer.from(b64string!, "base64");

        const token = jwt.sign(
          {
            data: {
              id: user.id,
              sessionId: crypto.randomBytes(32).toString("hex"),
            },
          },
          secret,
          {
            expiresIn: "8h",
            algorithm: "HS256",
          }
        );

        // Create session
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: token,
            expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
            userAgent: request.headers["user-agent"] || "",
            ipAddress: request.ip,
          },
        });

        await tracking("user_logged_in_microsoft", {
          isNew: user.createdAt === user.updatedAt,
          isAdmin: user.isAdmin,
          isManager: user.isManager,
        });

        metrics.incrementLogins("microsoft");

        // Return token and user info
        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          isManager: user.isManager,
          language: user.language,
          ticket_created: user.notify_ticket_created,
          ticket_status_changed: user.notify_ticket_status_changed,
          ticket_comments: user.notify_ticket_comments,
          ticket_assigned: user.notify_ticket_assigned,
          firstLogin: user.firstLogin,
          external_user: user.external_user,
        };

        reply.send({
          success: true,
          token: token,
          user: userData,
        });
      } catch (error: any) {
        console.error("Microsoft callback error:", error);
        reply.code(500).send({
          success: false,
          error: "Authentication failed",
          details: error.message,
        });
      }
    }
  );

  // Delete a user
  fastify.delete(
    "/api/v1/auth/user/:id",
    {
      preHandler: requirePermission(["user::delete"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Check if user exists
      const userToDelete = await prisma.user.findUnique({
        where: { id },
      });

      if (!userToDelete) {
        return reply.code(404).send({
          message: "User not found",
          success: false,
        });
      }

      // Prevent deletion of admin accounts if they're the last admin
      if (userToDelete.isAdmin) {
        const adminCount = await prisma.user.count({
          where: { isAdmin: true },
        });

        if (adminCount <= 1) {
          return reply.code(400).send({
            message: "Cannot delete the last admin account",
            success: false,
          });
        }
      }

      await prisma.notes.deleteMany({ where: { userId: id } });
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.notifications.deleteMany({ where: { userId: id } });

      await prisma.user.delete({
        where: { id },
      });

      reply.send({ success: true });
    }
  );

  // User Profile
  fastify.get(
    "/api/v1/auth/profile",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let session = await prisma.session.findUnique({
        where: {
          sessionToken: request.headers.authorization!.split(" ")[1],
        },
      });

      await checkSession(request);

      let user = await prisma.user.findUnique({
        where: { id: session!.userId },
      });

      if (!user) {
        return reply.code(401).send({
          message: "Invalid user",
        });
      }

      const config = await prisma.config.findFirst();

      const notifcations = await prisma.notifications.findMany({
        where: { userId: user!.id },
        orderBy: {
          createdAt: "desc",
        },
      });

      const data = {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        isAdmin: user!.isAdmin,
        isManager: user!.isManager ?? false,
        language: user!.language,
        ticket_created: user!.notify_ticket_created,
        ticket_status_changed: user!.notify_ticket_status_changed,
        ticket_comments: user!.notify_ticket_comments,
        ticket_assigned: user!.notify_ticket_assigned,
        sso_status: config!.sso_active,
        version: config!.client_version,
        notifcations,
        external_user: user!.external_user,
        microsoft_user: !!user!.microsoftAzureId,
      };

      await tracking("user_profile", {});

      reply.send({
        user: data,
      });
    }
  );

  // Reset Users password
  fastify.post(
    "/api/v1/auth/reset-password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { password } = request.body as {
        password: string;
      };

      const session = await checkSession(request);

      // Block M365-synced users from setting a local password
      const user = await prisma.user.findUnique({
        where: { id: session?.id },
        select: { microsoftAzureId: true },
      });

      if (user?.microsoftAzureId) {
        return reply.code(403).send({
          message: "Password reset is not available for Microsoft 365 synced users.",
          success: false,
        });
      }

      const hashedPass = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: session?.id },
        data: {
          password: hashedPass,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Reset password by admin
  fastify.post(
    "/api/v1/auth/admin/reset-password",
    {
      preHandler: requirePermission(["user::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { password, user } = request.body as {
        password: string;
        user: string;
      };

      const bearer = request.headers.authorization!.split(" ")[1];
      let session = await prisma.session.findUnique({
        where: {
          sessionToken: bearer,
        },
      });

      const check = await prisma.user.findUnique({
        where: { id: session?.userId },
      });

      if (check?.isAdmin === false) {
        return reply.code(401).send({
          message: "Unauthorized",
        });
      }

      // Block admin from resetting password for M365-synced users
      const targetUser = await prisma.user.findUnique({
        where: { id: user },
        select: { microsoftAzureId: true },
      });

      if (targetUser?.microsoftAzureId) {
        return reply.code(403).send({
          message: "Password reset is not available for Microsoft 365 synced users.",
          success: false,
        });
      }

      const hashedPass = await bcrypt.hash(password, 10);

      await prisma.user.update({
        where: { id: user },
        data: {
          password: hashedPass,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Update a users profile/config
  fastify.put(
    "/api/v1/auth/profile",
    {
      preHandler: requirePermission(["user::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      const { name, email, language } = request.body as {
        name: string;
        email: string;
        language: string;
      };

      let user = await prisma.user.update({
        where: { id: session?.id },
        data: {
          name: name,
          email: email,
          language: language,
        },
      });

      reply.send({
        user,
      });
    }
  );

  // Update a users Email notification settings
  fastify.put(
    "/api/v1/auth/profile/notifcations/emails",
    {
      preHandler: requirePermission(["user::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      const {
        notify_ticket_created,
        notify_ticket_assigned,
        notify_ticket_comments,
        notify_ticket_status_changed,
      } = request.body as any;

      let user = await prisma.user.update({
        where: { id: session?.id },
        data: {
          notify_ticket_created: notify_ticket_created,
          notify_ticket_assigned: notify_ticket_assigned,
          notify_ticket_comments: notify_ticket_comments,
          notify_ticket_status_changed: notify_ticket_status_changed,
        },
      });

      reply.send({
        user,
      });
    }
  );

  // Logout a user (deletes session)
  fastify.get(
    "/api/v1/auth/user/:id/logout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      await prisma.session.deleteMany({
        where: { userId: id },
      });

      reply.send({ success: true });
    }
  );

  // Update a users role
  fastify.put(
    "/api/v1/auth/user/role",
    {
      preHandler: requirePermission(["user::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (session?.isAdmin) {
        const { id, role } = request.body as { id: string; role: "user" | "manager" | "admin" };
        
        // Check if trying to remove admin and ensure at least one admin remains
        if (role !== "admin") {
          const targetUser = await prisma.user.findUnique({ where: { id } });
          if (targetUser?.isAdmin) {
            const admins = await prisma.user.findMany({
              where: { isAdmin: true },
            });
            if (admins.length === 1) {
              reply.code(400).send({
                message: "Mindestens ein Admin erforderlich",
                success: false,
              });
              return;
            }
          }
        }
        
        await prisma.user.update({
          where: { id },
          data: {
            isAdmin: role === "admin",
            isManager: role === "manager",
          },
        });

        reply.send({ success: true });
      } else {
        reply.code(401).send({
          message: "Unauthorized",
          success: false,
        });
      }
    }
  );

  // first login
  fastify.post(
    "/api/v1/auth/user/:id/first-login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      await prisma.user.update({
        where: { id },
        data: {
          firstLogin: false,
        },
      });

      await tracking("user_first_login", {});

      reply.send({ success: true });
    }
  );

  // Add a new endpoint to list and manage active sessions
  fastify.get(
    "/api/v1/auth/sessions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const sessions = await prisma.session.findMany({
        where: { userId: currentUser.id },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expires: true,
        },
      });

      reply.send({ sessions });
    }
  );

  // Add ability to revoke specific sessions
  fastify.delete(
    "/api/v1/auth/sessions/:sessionId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { sessionId } = request.params as { sessionId: string };

      // Only allow users to delete their own sessions
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: currentUser.id,
        },
      });

      if (!session) {
        return reply.code(404).send({ message: "Session not found" });
      }

      await prisma.session.delete({
        where: { id: sessionId },
      });

      reply.send({ success: true });
    }
  );

  // ── API Key Management (admin only) ──

  // List all API keys
  fastify.get(
    "/api/v1/auth/api-keys",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser || !currentUser.isAdmin) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const keys = await prisma.session.findMany({
        where: { apiKey: true },
        select: {
          id: true,
          createdAt: true,
          expires: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      reply.send({ success: true, keys });
    }
  );

  // Create a new API key
  fastify.post(
    "/api/v1/auth/api-keys",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser || !currentUser.isAdmin) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const secret = Buffer.from(process.env.SECRET!, "base64");
      const token = jwt.sign(
        {
          data: {
            id: currentUser.id,
            sessionId: crypto.randomBytes(32).toString("hex"),
          },
        },
        secret,
        { expiresIn: "365d", algorithm: "HS256" }
      );

      await prisma.session.create({
        data: {
          userId: currentUser.id,
          sessionToken: token,
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          apiKey: true,
        },
      });

      reply.send({ success: true, token });
    }
  );

  // Revoke an API key
  fastify.delete(
    "/api/v1/auth/api-keys/:keyId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = await checkSession(request);
      if (!currentUser || !currentUser.isAdmin) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const { keyId } = request.params as { keyId: string };

      const key = await prisma.session.findFirst({
        where: { id: keyId, apiKey: true },
      });

      if (!key) {
        return reply.code(404).send({ message: "API key not found" });
      }

      await prisma.session.delete({ where: { id: keyId } });

      reply.send({ success: true });
    }
  );
}
