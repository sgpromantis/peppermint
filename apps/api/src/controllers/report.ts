import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

const REPORTS_DIR = path.resolve("uploads/reports");
fs.mkdirSync(REPORTS_DIR, { recursive: true });

/**
 * Extract plain text from a BlockNote JSON string.
 * Falls back gracefully for plain text or legacy HTML tickets.
 */
function blockNoteToText(detail: string | null): string {
  if (!detail) return "";
  try {
    const blocks = JSON.parse(detail);
    if (!Array.isArray(blocks)) return detail;

    const extractInline = (content: any[]): string => {
      if (!Array.isArray(content)) return "";
      return content
        .map((item: any) => {
          if (item.type === "text") return item.text ?? "";
          if (item.type === "link") return extractInline(item.content ?? []);
          return "";
        })
        .join("");
    };

    const extractBlock = (block: any): string => {
      const line = extractInline(block.content ?? []);
      const children = (block.children ?? []).map(extractBlock).join("\n");
      return children ? line + "\n" + children : line;
    };

    return blocks.map(extractBlock).join("\n").trim();
  } catch {
    return detail.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  }
}

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
          "Beschreibung",
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
            escape(blockNoteToText(t.detail)),
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

  // ─── helpers shared by PDF builder ───────────────────────────────
  const MONTH_NAMES_DE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  const STATUS_DE: Record<string, string> = {
    needs_support: "Offen",
    in_progress: "In Bearbeitung",
    waiting_on_customer: "Wartet auf Kunde",
    waiting_on_third_party: "Wartet auf Dritte",
    resolved: "Gelöst",
  };

  const PRIORITY_DE: Record<string, string> = {
    Low: "Niedrig",
    Normal: "Normal",
    High: "Hoch",
  };

  function fmtMin(min: number): string {
    if (!min) return "–";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} Min.`;
    return `${h} Std.${m > 0 ? ` ${m} Min.` : ""}`;
  }

  function fmtDate(d: Date): string {
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /**
   * GET /api/v1/report/monthly/pdf
   * Query params: year, month (1-12), clientId? (optional)
   * Generates a professionally styled PDF, saves it to the reports directory,
   * and returns it for download.
   */
  fastify.get(
    "/api/v1/report/monthly/pdf",
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
      const monthName = MONTH_NAMES_DE[m - 1];

      const where: any = { createdAt: { gte: from, lt: to } };
      if (clientId) where.clientId = clientId;

      const tickets = await prisma.ticket.findMany({
        where,
        orderBy: { Number: "asc" },
        include: {
          assignedTo: { select: { name: true } },
          client: { select: { id: true, name: true } },
          Comment: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
          TimeTracking: { orderBy: { createdAt: "asc" } },
        },
      });

      const enriched = tickets.map((t) => ({
        ...t,
        totalMinutes: t.TimeTracking.reduce((s, tt) => s + tt.time, 0),
      }));

      // Build client summary
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
      const summaryRows = Object.values(clientSummary);

      // Client name for filename
      let clientLabel = "";
      if (clientId) {
        const cl = await prisma.client.findUnique({
          where: { id: clientId },
          select: { name: true },
        });
        if (cl) clientLabel = `_${cl.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}`;
      }

      const filename = `Monatsbericht_${y}_${String(m).padStart(2, "0")}${clientLabel}.pdf`;
      const filePath = path.join(REPORTS_DIR, filename);

      // ── Build PDF ──────────────────────────────────────────
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Monatsbericht ${monthName} ${y}`,
          Author: "promantis Helpdesk",
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageW = doc.page.width - 100; // usable width
      const ACCENT = "#2563EB";       // blue-600
      const ACCENT_LIGHT = "#DBEAFE"; // blue-100
      const GRAY = "#6B7280";
      const GRAY_BG = "#F3F4F6";

      // ── Header bar ─────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 100).fill(ACCENT);
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#FFFFFF")
        .text(`Monatsbericht`, 50, 30, { width: pageW });
      doc
        .font("Helvetica")
        .fontSize(14)
        .fillColor("#DBEAFE")
        .text(
          `${monthName} ${y}${clientLabel ? ` – ${clientLabel.replace(/_/g, " ").trim()}` : ""}`,
          50,
          60,
          { width: pageW }
        );

      // ── Meta line ──────────────────────────────────────────
      doc.fillColor(GRAY).font("Helvetica").fontSize(9);
      doc.text(
        `Erstellt am ${fmtDate(new Date())} · ${enriched.length} Tickets`,
        50,
        115,
        { width: pageW }
      );

      doc.y = 140;

      // Check if any ticket has time tracking data
      const hasTimeData = enriched.some((t) => t.totalMinutes > 0);

      // ── Summary table ──────────────────────────────────────
      if (summaryRows.length > 0) {
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(13);
        doc.text("Zusammenfassung", 50, doc.y, { width: pageW });
        doc.moveDown(0.5);

        const colWidths = hasTimeData
          ? [pageW * 0.55, pageW * 0.2, pageW * 0.25]
          : [pageW * 0.7, pageW * 0.3];
        const tableX = 50;
        let rowY = doc.y;

        // Header row
        doc.rect(tableX, rowY, pageW, 22).fill(ACCENT);
        doc.fillColor("#FFF").font("Helvetica-Bold").fontSize(9);
        doc.text("Kunde", tableX + 6, rowY + 6, { width: colWidths[0] });
        doc.text("Tickets", tableX + colWidths[0] + 6, rowY + 6, {
          width: colWidths[1],
          align: "right",
        });
        if (hasTimeData) {
          doc.text("Zeit", tableX + colWidths[0] + colWidths[1] + 6, rowY + 6, {
            width: colWidths[2],
            align: "right",
          });
        }
        rowY += 22;

        // Data rows
        let totalTickets = 0;
        let totalMin = 0;
        for (let i = 0; i < summaryRows.length; i++) {
          const r = summaryRows[i];
          totalTickets += r.ticketCount;
          totalMin += r.totalMinutes;
          if (i % 2 === 0) {
            doc.rect(tableX, rowY, pageW, 20).fill(GRAY_BG);
          }
          doc.fillColor("#000").font("Helvetica").fontSize(9);
          doc.text(r.name, tableX + 6, rowY + 5, { width: colWidths[0] });
          doc.text(String(r.ticketCount), tableX + colWidths[0] + 6, rowY + 5, {
            width: colWidths[1],
            align: "right",
          });
          if (hasTimeData) {
            doc.text(
              fmtMin(r.totalMinutes),
              tableX + colWidths[0] + colWidths[1] + 6,
              rowY + 5,
              { width: colWidths[2], align: "right" }
            );
          }
          rowY += 20;
        }

        // Totals row
        doc.rect(tableX, rowY, pageW, 22).fill(ACCENT_LIGHT);
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);
        doc.text("Gesamt", tableX + 6, rowY + 6, { width: colWidths[0] });
        doc.text(String(totalTickets), tableX + colWidths[0] + 6, rowY + 6, {
          width: colWidths[1],
          align: "right",
        });
        if (hasTimeData) {
          doc.text(
            fmtMin(totalMin),
            tableX + colWidths[0] + colWidths[1] + 6,
            rowY + 6,
            { width: colWidths[2], align: "right" }
          );
        }
        rowY += 22;

        doc.y = rowY + 16;
      }

      // ── Ticket details ─────────────────────────────────────
      if (enriched.length > 0) {
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(13);
        doc.text("Ticket-Details", 50, doc.y, { width: pageW });
        doc.moveDown(0.5);
      }

      for (const ticket of enriched) {
        // Check if we need a new page (minimum space for ticket header)
        if (doc.y > doc.page.height - 160) {
          doc.addPage();
        }

        const ticketStartY = doc.y;

        // Ticket header bar
        doc.rect(50, ticketStartY, pageW, 28).fill(ACCENT_LIGHT);
        doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10);
        doc.text(
          `#${ticket.Number}  ${ticket.title}`,
          56,
          ticketStartY + 8,
          { width: pageW - 180 }
        );

        // Badges on right
        const badgeY = ticketStartY + 8;
        const badgeData = [
          ticket.type || "",
          PRIORITY_DE[ticket.priority] || ticket.priority,
          ticket.isComplete
            ? "Geschlossen"
            : STATUS_DE[ticket.status] || ticket.status,
        ].filter(Boolean);
        let badgeX = 50 + pageW - 8;
        doc.font("Helvetica").fontSize(7).fillColor(ACCENT);
        for (const badge of badgeData.reverse()) {
          const bw = doc.widthOfString(badge) + 10;
          badgeX -= bw + 4;
          doc
            .roundedRect(badgeX, badgeY - 1, bw, 14, 3)
            .fill(ACCENT);
          doc.fillColor("#FFF").text(badge, badgeX + 5, badgeY + 1);
          doc.fillColor(ACCENT);
        }

        doc.y = ticketStartY + 34;

        // Meta grid
        const metaItems = [
          ["Erstellt", fmtDate(new Date(ticket.createdAt))],
          ...(ticket.isComplete
            ? [["Geschlossen", fmtDate(new Date(ticket.updatedAt))]]
            : []),
          ["Zugewiesen", ticket.assignedTo?.name || "–"],
          ["Kunde", ticket.client?.name || "–"],
          ...(hasTimeData ? [["Zeit", fmtMin(ticket.totalMinutes)]] : []),
        ];

        const metaColW = pageW / 3;
        let metaX = 56;
        let metaY = doc.y;
        for (let i = 0; i < metaItems.length; i++) {
          if (i > 0 && i % 3 === 0) {
            metaX = 56;
            metaY += 24;
          }
          doc.fillColor(GRAY).font("Helvetica").fontSize(7);
          doc.text(metaItems[i][0], metaX, metaY, { width: metaColW });
          doc.fillColor("#000").font("Helvetica-Bold").fontSize(8);
          doc.text(metaItems[i][1], metaX, metaY + 9, { width: metaColW });
          metaX += metaColW;
        }
        doc.y = metaY + 30;

        // Description
        const desc = blockNoteToText(ticket.detail);
        if (desc) {
          if (doc.y > doc.page.height - 80) doc.addPage();
          doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8);
          doc.text("Beschreibung", 56, doc.y);
          doc.moveDown(0.2);
          doc.fillColor("#000").font("Helvetica").fontSize(8);
          doc.text(desc, 56, doc.y, {
            width: pageW - 12,
            lineGap: 2,
          });
          doc.moveDown(0.3);
        }

        // Comments
        if (ticket.Comment.length > 0) {
          if (doc.y > doc.page.height - 80) doc.addPage();
          doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8);
          doc.text(`Kommentare (${ticket.Comment.length})`, 56, doc.y);
          doc.moveDown(0.2);

          for (const c of ticket.Comment) {
            if (doc.y > doc.page.height - 60) doc.addPage();
            const commentDate = fmtDate(new Date(c.createdAt));
            const author = (c as any).user?.name || "System";

            doc.fillColor(GRAY).font("Helvetica").fontSize(7);
            doc.text(`${author} · ${commentDate}`, 62, doc.y);
            doc.moveDown(0.1);
            doc.fillColor("#000").font("Helvetica").fontSize(8);
            doc.text(c.text, 62, doc.y, {
              width: pageW - 24,
              lineGap: 1,
            });
            doc.moveDown(0.3);
          }
        }

        // Separator line
        doc.moveTo(50, doc.y + 4).lineTo(50 + pageW, doc.y + 4).stroke("#E5E7EB");
        doc.y += 14;
      }

      // ── Page numbers ───────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        // Save/restore to avoid side-effects on doc.y that create extra pages
        doc.save();
        const footerText = `Monatsbericht ${monthName} ${y}  ·  Seite ${i + 1} von ${range.count}`;
        const tw = doc.font("Helvetica").fontSize(8).widthOfString(footerText);
        doc
          .fillColor(GRAY)
          .text(
            footerText,
            (doc.page.width - tw) / 2,
            doc.page.height - 40,
            { lineBreak: false }
          );
        doc.restore();
      }

      doc.end();

      // Wait for the file to be written
      await new Promise<void>((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      // Send the file
      const fileBuffer = fs.readFileSync(filePath);
      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        )
        .send(fileBuffer);
    }
  );

  /**
   * GET /api/v1/report/list
   * Returns a list of all generated PDF reports in the reports directory.
   */
  fastify.get(
    "/api/v1/report/list",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);

      const files = fs.existsSync(REPORTS_DIR)
        ? fs
            .readdirSync(REPORTS_DIR)
            .filter((f) => f.endsWith(".pdf"))
            .map((f) => {
              const stat = fs.statSync(path.join(REPORTS_DIR, f));
              return {
                filename: f,
                size: stat.size,
                createdAt: stat.mtime.toISOString(),
              };
            })
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
        : [];

      reply.send({ success: true, reports: files });
    }
  );

  /**
   * GET /api/v1/report/download/:filename
   * Downloads a previously generated report from the reports directory.
   */
  fastify.get(
    "/api/v1/report/download/:filename",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await checkSession(request);

      const { filename } = request.params as { filename: string };

      // Sanitize: only allow PDF filenames with safe characters
      if (!/^[a-zA-Z0-9äöüÄÖÜß_\-. ]+\.pdf$/i.test(filename)) {
        return reply.code(400).send({ message: "Invalid filename" });
      }

      const filePath = path.join(REPORTS_DIR, path.basename(filename));
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ message: "Report not found" });
      }

      const fileBuffer = fs.readFileSync(filePath);
      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${path.basename(filename)}"`
        )
        .send(fileBuffer);
    }
  );
}
