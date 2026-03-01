// Check Github Version
// Add outbound email provider
// Email Verification
// SSO Provider
// Portal Locale
// Feature Flags
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
const nodemailer = require("nodemailer");

import { track } from "../lib/hog";
import { createTransportProvider } from "../lib/nodemailer/transport";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { EncryptionService } from "../lib/services/encryption.service";
import { prisma } from "../prisma";

async function tracking(event: string, properties: any) {
  const client = track();

  client.capture({
    event: event,
    properties: properties,
    distinctId: "uuid",
  });
}

export function configRoutes(fastify: FastifyInstance) {
  // Check auth method
  fastify.get(
    "/api/v1/config/authentication/check",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = await prisma.config.findFirst();

      //@ts-expect-error
      const { sso_active, sso_provider } = config;

      if (sso_active) {
        reply.send({
          success: true,
          sso: sso_active,
          provider: sso_provider,
        });
      }

      reply.send({
        success: true,
        sso: sso_active,
      });
    }
  );

  // Update OIDC Provider
  fastify.post(
    "/api/v1/config/authentication/oidc/update",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const { clientId, clientSecret, redirectUri, issuer, jwtSecret }: any =
        request.body;

      const conf = await prisma.config.findFirst();

      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: true,
          sso_provider: "oidc",
        },
      });

      const existingProvider = await prisma.openIdConfig.findFirst();

      if (existingProvider === null) {
        await prisma.openIdConfig.create({
          data: {
            clientId: clientId,
            redirectUri: redirectUri,
            issuer: issuer,
          },
        });
      } else {
        await prisma.openIdConfig.update({
          where: { id: existingProvider.id },
          data: {
            clientId: clientId,
            redirectUri: redirectUri,
            issuer: issuer,
          },
        });
      }

      await tracking("oidc_provider_updated", {});

      reply.send({
        success: true,
        message: "OIDC config Provider updated!",
      });
    }
  );

  // Update Oauth Provider
  fastify.post(
    "/api/v1/config/authentication/oauth/update",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        name,
        clientId,
        clientSecret,
        redirectUri,
        tenantId,
        issuer,
        jwtSecret,
      }: any = request.body;

      const conf = await prisma.config.findFirst();

      // Update config to true
      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: true,
          sso_provider: "oauth",
        },
      });

      // Encrypt sensitive credentials
      const encryptedClientSecret = await EncryptionService.encrypt(clientSecret);

      // Check if the provider exists
      const existingProvider = await prisma.oAuthProvider.findFirst();

      if (existingProvider === null) {
        await prisma.oAuthProvider.create({
          data: {
            name: name,
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            redirectUri: redirectUri,
            scope: "", // Add appropriate scope if needed
            authorizationUrl: "", // Add appropriate URL if needed
            tokenUrl: "", // Add appropriate URL if needed
            userInfoUrl: "", // Add appropriate URL if needed
          },
        });
      } else {
        await prisma.oAuthProvider.update({
          where: { id: existingProvider.id },
          data: {
            clientId: clientId,
            clientSecret: encryptedClientSecret,
            redirectUri: redirectUri,
          },
        });
      }

      await tracking("oauth_provider_updated", {});

      reply.send({
        success: true,
        message: "SSO Provider updated!",
      });
    }
  );

  // Delete auth config
  fastify.delete(
    "/api/v1/config/authentication",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const conf = await prisma.config.findFirst();

      // Update config to false
      await prisma.config.update({
        where: { id: conf!.id },
        data: {
          sso_active: false,
          sso_provider: "",
        },
      });

      // Delete the OAuth provider
      await prisma.oAuthProvider.deleteMany({});

      await tracking("sso_provider_deleted", {});

      reply.send({
        success: true,
        message: "SSO Provider deleted!",
      });
    }
  );

  // Check if Azure AD / Microsoft 365 SSO is enabled
  fastify.get(
    "/api/v1/config/authentication/azure-ad/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const config = await prisma.config.findFirst();
        const isEnabled = (config?.microsoft_ad_enabled as boolean) || false;
        const redirectUri = (config?.microsoft_ad_redirect_uri as string) || "";

        reply.send({
          success: true,
          enabled: isEnabled,
          redirectUri: redirectUri,
        });
      } catch (error: any) {
        reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Enable Azure AD / Microsoft 365 SSO
  fastify.post(
    "/api/v1/config/authentication/azure-ad/enable",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const { redirectUri } = request.body as { redirectUri?: string };
        const conf = await prisma.config.findFirst();

        // Verify Graph config exists (required for Azure AD)
        const graphConfig = await prisma.config.findFirst({
          where: {
            AND: [
              { ms_graph_client_id: { not: null } },
              { ms_graph_client_secret: { not: null } },
              { ms_graph_tenant_id: { not: null } },
            ],
          },
        });

        if (!graphConfig) {
          return reply.status(400).send({
            success: false,
            error: "Microsoft Graph configuration required. Please configure Microsoft Graph credentials first.",
          });
        }

        const finalRedirectUri = redirectUri || `${process.env.REDIRECT_URI || "http://localhost:3000"}/auth/microsoft/callback`;

        await prisma.config.update({
          where: { id: conf!.id },
          data: {
            microsoft_ad_enabled: true,
            microsoft_ad_redirect_uri: finalRedirectUri,
          },
        });

        await tracking("azure_ad_sso_enabled", {});

        reply.send({
          success: true,
          message: "Azure AD SSO enabled!",
          redirectUri: finalRedirectUri,
        });
      } catch (error: any) {
        reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Disable Azure AD / Microsoft 365 SSO
  fastify.post(
    "/api/v1/config/authentication/azure-ad/disable",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const conf = await prisma.config.findFirst();

        await prisma.config.update({
          where: { id: conf!.id },
          data: {
            microsoft_ad_enabled: false,
          },
        });

        await tracking("azure_ad_sso_disabled", {});

        reply.send({
          success: true,
          message: "Azure AD SSO disabled!",
        });
      } catch (error: any) {
        reply.status(500).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Check if Emails are enabled & GET email settings
  fastify.get(
    "/api/v1/config/email",

    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const bearer = request.headers.authorization!.split(" ")[1];
        // GET EMAIL SETTINGS
        const config = await prisma.email.findFirst({
          select: {
            active: true,
            host: true,
            port: true,
            reply: true,
            user: true,
            supportMailbox: true,
          },
        });

        const emailConfig = config || null;

        if (emailConfig && emailConfig?.active) {
          const provider = await createTransportProvider();

          return await new Promise((resolve, reject) => {
            provider.verify(function (error: any, success: any) {
              if (error) {
                console.log("SMTP verification error:", error);
                resolve(
                  reply.send({
                    success: true,
                    active: true,
                    email: emailConfig,
                    verification: error,
                  })
                );
              } else {
                console.log("SMTP verification success - server is ready");
                resolve(
                  reply.send({
                    success: true,
                    active: true,
                    email: emailConfig,
                    verification: success,
                  })
                );
              }
            });
          });
        }

        return reply.send({
          success: true,
          active: false,
        });
      } catch (error: any) {
        console.error("Error fetching email config:", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch email configuration",
          error: error?.message || "Unknown error",
        });
      }
    }
  );

  // Update Email Provider Settings
  fastify.put(
    "/api/v1/config/email",

    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const {
          host,
          active,
          port,
          reply: replyto,
          username,
          password,
          serviceType,
          clientId,
          clientSecret,
          redirectUri,
          supportMailbox,
        }: any = request.body;

        console.log("Saving email config:", { host, port, replyto, username, serviceType, active });

        const email = await prisma.email.findFirst();

        if (email === null) {
          await prisma.email.create({
            data: {
              host: host,
              port: port,
              reply: replyto,
              user: username,
              pass: password,
              active: true,
              clientId: clientId || undefined,
              clientSecret: clientSecret || undefined,
              serviceType: serviceType || "other",
              redirectUri: redirectUri || undefined,
              supportMailbox: supportMailbox || undefined,
            },
          });
        } else {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              host: host,
              port: port,
              reply: replyto,
              user: username,
              pass: password,
              active: active,
              clientId: clientId || undefined,
              clientSecret: clientSecret || undefined,
              serviceType: serviceType || "other",
              redirectUri: redirectUri || undefined,
              supportMailbox: supportMailbox || null,
            },
          });
        }

        console.log("Email config saved successfully");

        if (serviceType === "gmail") {
          const updatedEmail = await prisma.email.findFirst();

          const google = new OAuth2Client(
            //@ts-expect-error
            updatedEmail?.clientId,
            updatedEmail?.clientSecret,
            updatedEmail?.redirectUri
          );

          const authorizeUrl = google.generateAuthUrl({
            access_type: "offline",
            scope: "https://mail.google.com",
            prompt: "consent",
          });

          return reply.send({
            success: true,
            message: "SSO Provider updated!",
            authorizeUrl: authorizeUrl,
          });
        }

        return reply.send({
          success: true,
          message: "SSO Provider updated!",
        });
      } catch (error: any) {
        console.error("Error saving email config:", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to save email configuration",
          error: error?.message || "Unknown error",
        });
      }
    }
  );

  // Google oauth callback
  fastify.get(
    "/api/v1/config/email/oauth/gmail",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code }: any = request.query;

      const email = await prisma.email.findFirst();

      const google = new OAuth2Client(
        //@ts-expect-error
        email?.clientId,
        email?.clientSecret,
        email?.redirectUri
      );

      const r = await google.getToken(code);

      await prisma.email.update({
        where: { id: email?.id },
        data: {
          refreshToken: r.tokens.refresh_token,
          accessToken: r.tokens.access_token,
          expiresIn: r.tokens.expiry_date,
          serviceType: "gmail",
        },
      });

      const provider = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: email?.user,
          clientId: email?.clientId,
          clientSecret: email?.clientSecret,
          refreshToken: r.tokens.refresh_token,
          accessToken: r.tokens.access_token,
          expiresIn: r.tokens.expiry_date,
        },
      });

      reply.send({
        success: true,
        message: "SSO Provider updated!",
      });
    }
  );

  // Disable/Enable Email
  fastify.delete(
    "/api/v1/config/email",

    async (request: FastifyRequest, reply: FastifyReply) => {
      await prisma.email.deleteMany({});

      reply.send({
        success: true,
        message: "Email settings deleted!",
      });
    }
  );

  // Toggle all roles
  fastify.patch(
    "/api/v1/config/toggle-roles",
    {
      preHandler: requirePermission(["settings::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { isActive }: any = request.body;
      const session = await checkSession(request);

      // Double-check that user is admin
      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const config = await prisma.config.findFirst();

      await prisma.config.update({
        where: { id: config!.id },
        data: {
          roles_active: isActive,
        },
      });

      reply.send({
        success: true,
        message: "Roles updated!",
      });
    }
  );

  // Get Microsoft Graph configuration
  fastify.get(
    "/api/v1/config/microsoft-graph",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const config = await prisma.config.findFirst();

      reply.send({
        success: true,
        clientId: config?.ms_graph_client_id || "",
        clientSecret: config?.ms_graph_client_secret || "",
        tenantId: config?.ms_graph_tenant_id || "",
      });
    }
  );

  // Update Microsoft Graph configuration
  fastify.put(
    "/api/v1/config/microsoft-graph",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const { clientId, clientSecret, tenantId }: any = request.body;

      let config = await prisma.config.findFirst();

      if (!config) {
        // Create if doesn't exist
        config = await prisma.config.create({
          data: {
            ms_graph_client_id: clientId,
            ms_graph_client_secret: clientSecret,
            ms_graph_tenant_id: tenantId,
          },
        });
      } else {
        // Update existing
        config = await prisma.config.update({
          where: { id: config.id },
          data: {
            ms_graph_client_id: clientId,
            ms_graph_client_secret: clientSecret,
            ms_graph_tenant_id: tenantId,
          },
        });
      }

      reply.send({
        success: true,
        message: "Microsoft Graph configuration updated!",
        clientId: config.ms_graph_client_id,
        clientSecret: config.ms_graph_client_secret,
        tenantId: config.ms_graph_tenant_id,
      });
    }
  );

  // Get ticket portal URL configuration
  fastify.get(
    "/api/v1/config/ticket-portal-url",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const config = await prisma.config.findFirst();

      // Show effective URL (what emails would actually use)
      const effectiveUrl = config?.ticketPortalUrl
        || process.env.BASE_URL
        || process.env.NEXT_PUBLIC_URL
        || "http://localhost:3000";

      reply.send({
        success: true,
        ticketPortalUrl: config?.ticketPortalUrl || "",
        effectiveUrl,
      });
    }
  );

  // Update ticket portal URL configuration
  fastify.put(
    "/api/v1/config/ticket-portal-url",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await checkSession(request);

      if (!session?.isAdmin) {
        return reply.code(403).send({
          message: "Unauthorized. Admin access required.",
          success: false,
        });
      }

      const { ticketPortalUrl }: any = request.body;

      // Validate URL format if provided
      if (ticketPortalUrl && ticketPortalUrl.trim() !== "") {
        try {
          new URL(ticketPortalUrl);
        } catch {
          return reply.code(400).send({
            success: false,
            message: "Ungültige URL. Bitte eine gültige URL eingeben (z.B. https://helpdesk.example.com).",
          });
        }
      }

      let config = await prisma.config.findFirst();

      const urlValue = ticketPortalUrl?.trim() || null;

      if (!config) {
        config = await prisma.config.create({
          data: {
            ticketPortalUrl: urlValue,
          },
        });
      } else {
        config = await prisma.config.update({
          where: { id: config.id },
          data: {
            ticketPortalUrl: urlValue,
          },
        });
      }

      // Return the effective URL after the change
      const effectiveUrl = config.ticketPortalUrl
        || process.env.BASE_URL
        || process.env.NEXT_PUBLIC_URL
        || "http://localhost:3000";

      reply.send({
        success: true,
        message: "Ticket-Portal-URL wurde aktualisiert!",
        ticketPortalUrl: config.ticketPortalUrl || "",
        effectiveUrl,
      });
    }
  );
}
