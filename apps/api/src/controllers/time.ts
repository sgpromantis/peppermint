import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function timeTrackingRoutes(fastify: FastifyInstance) {
  // Create a new entry
  fastify.post(
    "/api/v1/time/new",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const { time, ticket, title, user }: any = request.body;

      await prisma.timeTracking.create({
        data: {
          time: Number(time),
          title,
          userId: user,
          ticketId: ticket,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Delete an entry
  fastify.delete(
    "/api/v1/time/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);
      const { id } = request.params as { id: string };

      await prisma.timeTracking.delete({
        where: { id },
      });

      reply.send({ success: true });
    }
  );

  // Get all time entries (with filters for timesheet)
  fastify.get(
    "/api/v1/time/all",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);
      const { year, month, userId, clientId } = request.query as {
        year?: string;
        month?: string;
        userId?: string;
        clientId?: string;
      };

      const where: any = {};

      if (year && month) {
        const y = parseInt(year);
        const m = parseInt(month);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        where.createdAt = { gte: start, lt: end };
      }

      if (userId) {
        where.userId = userId;
      }

      if (clientId) {
        where.ticket = { clientId };
      }

      const entries = await prisma.timeTracking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          ticket: {
            select: {
              id: true,
              Number: true,
              title: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      reply.send({ success: true, entries });
    }
  );

  // Timesheet CSV export
  fastify.get(
    "/api/v1/time/export/csv",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);
      const { year, month, userId, clientId } = request.query as {
        year?: string;
        month?: string;
        userId?: string;
        clientId?: string;
      };

      const where: any = {};

      if (year && month) {
        const y = parseInt(year);
        const m = parseInt(month);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);
        where.createdAt = { gte: start, lt: end };
      }

      if (userId) {
        where.userId = userId;
      }

      if (clientId) {
        where.ticket = { clientId };
      }

      const entries = await prisma.timeTracking.findMany({
        where,
        include: {
          user: { select: { name: true } },
          ticket: {
            select: {
              Number: true,
              title: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const BOM = "\uFEFF";
      const header = "Datum;Benutzer;Ticket-Nr;Ticket;Kunde;Beschreibung;Minuten;Stunden\n";
      const rows = entries.map((e) => {
        const date = new Date(e.createdAt).toLocaleDateString("de-DE");
        const hours = (e.time / 60).toFixed(2).replace(".", ",");
        return [
          date,
          e.user?.name ?? "",
          e.ticket?.Number != null ? `#${e.ticket.Number}` : "",
          (e.ticket?.title ?? "").replace(/;/g, ","),
          e.ticket?.client?.name ?? "",
          (e.title ?? "").replace(/;/g, ","),
          String(e.time),
          hours,
        ].join(";");
      });

      const csv = BOM + header + rows.join("\n");

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="Zeiterfassung_${year || "alle"}_${month || "alle"}.csv"`
        )
        .send(csv);
    }
  );
}
