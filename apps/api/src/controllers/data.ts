import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function dataRoutes(fastify: FastifyInstance) {
  // Get total count of all tickets
  fastify.get(
    "/api/v1/data/tickets/all",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Admins and Managers can see all tickets, regular users only their own
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { hidden: false }
        : {
            hidden: false,
            OR: [
              { userId: user?.id },
              { createdBy: { path: ["id"], equals: user?.id } },
              { email: user?.email },
            ],
          };

      const result = await prisma.ticket.count({
        where: whereClause,
      });

      reply.send({ count: result });
    }
  );

  // Get total count of all completed tickets
  fastify.get(
    "/api/v1/data/tickets/completed",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Admins and Managers can see all tickets, regular users only their own
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { isComplete: true, hidden: false }
        : {
            isComplete: true,
            hidden: false,
            OR: [
              { userId: user?.id },
              { createdBy: { path: ["id"], equals: user?.id } },
              { email: user?.email },
            ],
          };

      const result = await prisma.ticket.count({
        where: whereClause,
      });

      reply.send({ count: result });
    }
  );

  // Get total count of all open tickets
  fastify.get(
    "/api/v1/data/tickets/open",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Admins and Managers can see all tickets, regular users only their own
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { isComplete: false, hidden: false }
        : {
            isComplete: false,
            hidden: false,
            OR: [
              { userId: user?.id },
              { createdBy: { path: ["id"], equals: user?.id } },
              { email: user?.email },
            ],
          };

      const result = await prisma.ticket.count({
        where: whereClause,
      });

      reply.send({ count: result });
    }
  );

  // Get total of all unsassigned tickets (only for admins, non-admins see 0)
  fastify.get(
    "/api/v1/data/tickets/unassigned",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { userId: null, hidden: false, isComplete: false }
        : {
            userId: null,
            hidden: false,
            isComplete: false,
            OR: [
              { createdBy: { path: ["id"], equals: user?.id } },
              { email: user?.email },
            ],
          };

      const result = await prisma.ticket.count({
        where: whereClause,
      });

      reply.send({ count: result });
    }
  );

  // Get all logs
  fastify.get(
    "/api/v1/data/logs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const logs = await import("fs/promises").then((fs) =>
        fs.readFile("logs.log", "utf-8")
      );
      reply.send({ logs: logs });
    }
  );
}
