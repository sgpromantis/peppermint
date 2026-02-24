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
        : { hidden: false, userId: user?.id };

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
        : { isComplete: true, hidden: false, userId: user?.id };

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
        : { isComplete: false, hidden: false, userId: user?.id };

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
      
      // Only Admins and Managers can see unassigned tickets
      const canSeeAll = user?.isAdmin || user?.isManager;
      if (!canSeeAll) {
        reply.send({ count: 0 });
        return;
      }

      const result = await prisma.ticket.count({
        where: { userId: null, hidden: false, isComplete: false },
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
