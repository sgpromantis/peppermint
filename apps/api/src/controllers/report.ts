import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function reportRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/report/monthly
   * Query params: year, month (1-12), clientId? (optional)
   * Returns all tickets created in that month with comments, time tracking,
   * assigned user and client – intended for billing reports.
   */
  fastify.get(
    "/api/v1/report/monthly",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);

      const { year, month, clientId } = request.query as {
        year: string;
        month: string;
        clientId?: string;
      };

      const y = parseInt(year, 10);
      const m = parseInt(month, 10); // 1-based

      if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
        return reply.code(400).send({ message: "Invalid year or month" });
      }

      const from = new Date(y, m - 1, 1);            // first of month
      const to = new Date(y, m, 1);                   // first of next month

      const where: any = {
        createdAt: { gte: from, lt: to },
      };

      if (clientId) {
        where.clientId = clientId;
      }

      const tickets = await prisma.ticket.findMany({
        where,
        orderBy: { Number: "asc" },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          client: {
            select: { id: true, name: true, contactName: true, email: true },
          },
          Comment: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, name: true } },
            },
          },
          TimeTracking: {
            orderBy: { createdAt: "asc" },
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Compute per-ticket time totals (minutes)
      const enriched = tickets.map((t) => {
        const totalMinutes = t.TimeTracking.reduce(
          (sum, tt) => sum + tt.time,
          0
        );
        return { ...t, totalMinutes };
      });

      // Aggregate by client for summary
      const clientSummary: Record<
        string,
        { name: string; ticketCount: number; totalMinutes: number }
      > = {};

      for (const t of enriched) {
        const key = t.client?.id ?? "__none__";
        const label = t.client?.name ?? "Kein Kunde";
        if (!clientSummary[key]) {
          clientSummary[key] = { name: label, ticketCount: 0, totalMinutes: 0 };
        }
        clientSummary[key].ticketCount += 1;
        clientSummary[key].totalMinutes += t.totalMinutes;
      }

      reply.send({
        success: true,
        year: y,
        month: m,
        tickets: enriched,
        clientSummary: Object.values(clientSummary),
      });
    }
  );

  /**
   * GET /api/v1/report/monthly/csv
   * Same params as above – returns a CSV file download.
   */
  fastify.get(
    "/api/v1/report/monthly/csv",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);

      const { year, month, clientId } = request.query as {
        year: string;
        month: string;
        clientId?: string;
      };

      const y = parseInt(year, 10);
      const m = parseInt(month, 10);

      if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
        return reply.code(400).send({ message: "Invalid year or month" });
      }

      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 1);

      const where: any = {
        createdAt: { gte: from, lt: to },
      };

      if (clientId) {
        where.clientId = clientId;
      }

      const tickets = await prisma.ticket.findMany({
        where,
        orderBy: { Number: "asc" },
        include: {
          assignedTo: { select: { name: true } },
          client: { select: { name: true } },
          Comment: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
          TimeTracking: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      const escape = (v: string | null | undefined) => {
        if (v == null) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      };

      const rows: string[] = [
        [
          "Ticket-Nr",
          "Titel",
          "Typ",
          "Priorität",
          "Status",
          "Erstellt am",
          "Geschlossen am",
          "Kontaktname",
          "Kontakt E-Mail",
          "Zugewiesen an",
          "Kunde",
          "Zeit (Min)",
          "Kommentare",
        ].join(";"),
      ];

      for (const t of tickets) {
        const totalMinutes = t.TimeTracking.reduce(
          (sum, tt) => sum + tt.time,
          0
        );
        const comments = t.Comment.map(
          (c) =>
            `[${new Date(c.createdAt).toLocaleDateString("de-DE")}${c.user ? " – " + c.user.name : ""}] ${c.text}`
        ).join(" | ");

        rows.push(
          [
            t.Number,
            escape(t.title),
            escape(t.type),
            escape(t.priority),
            escape(t.status),
            new Date(t.createdAt).toLocaleDateString("de-DE"),
            t.isComplete
              ? new Date(t.updatedAt).toLocaleDateString("de-DE")
              : "",
            escape(t.name),
            escape(t.email),
            escape(t.assignedTo?.name),
            escape(t.client?.name),
            totalMinutes,
            escape(comments),
          ].join(";")
        );
      }

      const csv = "\uFEFF" + rows.join("\r\n"); // BOM for Excel UTF-8

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="Monatsbericht_${y}_${String(m).padStart(2, "0")}.csv"`
        )
        .send(csv);
    }
  );
}
