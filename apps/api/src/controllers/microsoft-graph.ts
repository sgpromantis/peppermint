import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkSession } from "../lib/session";
import { MicrosoftGraphService } from "../lib/services/microsoft-graph.service";

export function microsoftGraphRoutes(fastify: FastifyInstance) {
  // Check if Microsoft Graph is configured
  fastify.get(
    "/api/v1/admin/microsoft-graph/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const isConfigured = await MicrosoftGraphService.isConfigured();
      const groupMapping = await MicrosoftGraphService.getGroupRoleMapping();
      
      reply.send({ 
        configured: isConfigured,
        groupMappingConfigured: !!groupMapping,
        groupMapping,
      });
    }
  );

  // List users from Azure AD
  fastify.get(
    "/api/v1/admin/microsoft-graph/users",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const { filter } = request.query as { filter?: string };
        const users = await MicrosoftGraphService.listUsers(filter);
        reply.send({ success: true, users });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // List all Microsoft 365 groups
  fastify.get(
    "/api/v1/admin/microsoft-graph/groups",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const groups = await MicrosoftGraphService.listGroups();
        reply.send({ success: true, groups });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Search Microsoft 365 groups by name or mail
  fastify.get(
    "/api/v1/admin/microsoft-graph/groups/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const { q } = request.query as { q?: string };
      if (!q || q.trim().length < 1) {
        return reply.send({ success: true, groups: [] });
      }

      try {
        const groups = await MicrosoftGraphService.searchGroups(q.trim());
        reply.send({ success: true, groups });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Get members of a specific group
  fastify.get(
    "/api/v1/admin/microsoft-graph/groups/:groupId/members",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const { groupId } = request.params as { groupId: string };

      try {
        const members = await MicrosoftGraphService.getGroupMembers(groupId);
        reply.send({ success: true, members });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Get current group-role mapping
  fastify.get(
    "/api/v1/admin/microsoft-graph/group-mapping",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const mapping = await MicrosoftGraphService.getGroupRoleMapping();
        reply.send({ success: true, mapping });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Save group-role mapping
  fastify.post(
    "/api/v1/admin/microsoft-graph/group-mapping",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const { 
        usersGroupId, 
        usersGroupName,
        managersGroupId, 
        managersGroupName,
        adminsGroupId,
        adminsGroupName,
      } = request.body as {
        usersGroupId?: string;
        usersGroupName?: string;
        managersGroupId?: string;
        managersGroupName?: string;
        adminsGroupId?: string;
        adminsGroupName?: string;
      };

      try {
        await MicrosoftGraphService.saveGroupRoleMapping({
          usersGroupId,
          usersGroupName,
          managersGroupId,
          managersGroupName,
          adminsGroupId,
          adminsGroupName,
        });
        reply.send({ success: true, message: "Group mapping saved" });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Preview sync from groups (dry run)
  fastify.get(
    "/api/v1/admin/microsoft-graph/sync-preview",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const preview = await MicrosoftGraphService.previewSync();
        reply.send({ success: true, preview });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Sync users from Microsoft 365 groups based on role mapping
  fastify.post(
    "/api/v1/admin/microsoft-graph/sync-groups",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const result = await MicrosoftGraphService.syncUsersFromGroups();
        reply.send({ success: true, ...result });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Legacy: Sync users from Azure AD (without groups)
  fastify.post(
    "/api/v1/admin/microsoft-graph/sync",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      try {
        const { filter, createAsAdmin, createAsManager } = request.body as {
          filter?: string;
          createAsAdmin?: boolean;
          createAsManager?: boolean;
        };

        const result = await MicrosoftGraphService.syncUsers({
          filter,
          createAsAdmin,
          createAsManager,
        });

        reply.send({ success: true, ...result });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );

  // Create a single user from Azure AD
  fastify.post(
    "/api/v1/admin/microsoft-graph/create-user",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user?.isAdmin) {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const { email, isAdmin, isManager } = request.body as {
        email: string;
        isAdmin?: boolean;
        isManager?: boolean;
      };

      if (!email) {
        return reply.status(400).send({ error: "Email is required" });
      }

      const result = await MicrosoftGraphService.createUserFromAzureAD(email, {
        isAdmin,
        isManager,
      });

      if (result.success) {
        reply.send({ success: true, user: result.user });
      } else {
        reply.status(400).send({ success: false, error: result.error });
      }
    }
  );
}
