import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import { metrics } from "../lib/prometheus-metrics";

export function prometheusRoutes(fastify: FastifyInstance) {
  // Prometheus metrics endpoint - no auth required for scraping
  // But you should restrict access via network/firewall in production
  fastify.get(
    "/metrics",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Optional: Check for bearer token if you want auth
      const authHeader = request.headers.authorization;
      const metricsToken = process.env.METRICS_TOKEN;

      if (metricsToken && authHeader !== `Bearer ${metricsToken}`) {
        // If METRICS_TOKEN is set, require it
        return reply.status(401).send("Unauthorized");
      }

      try {
        // Get runtime metrics from database
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get real-time database metrics
        const [
          totalTickets,
          openTickets,
          closedTickets,
          totalUsers,
          activeUsers,
          totalComments,
        ] = await Promise.all([
          prisma.ticket.count(),
          prisma.ticket.count({ where: { isComplete: false } }),
          prisma.ticket.count({ where: { isComplete: true } }),
          prisma.user.count(),
          prisma.session.count({
            where: { expires: { gte: now } },
          }),
          prisma.comment.count(),
        ]);

        // Tickets by priority
        const ticketsByPriority = await prisma.ticket.groupBy({
          by: ["priority"],
          _count: true,
        });

        // Tickets by status
        const ticketsByStatus = await prisma.ticket.groupBy({
          by: ["isComplete"],
          _count: true,
        });

        // Build Prometheus output
        let output = metrics.getPrometheusMetrics();

        // Add database metrics
        output += "\n\n# Database Metrics (real-time)\n";

        output += "# HELP promantis_tickets_total Total tickets in database\n";
        output += "# TYPE promantis_tickets_total gauge\n";
        output += `promantis_tickets_total ${totalTickets}\n`;

        output += "# HELP promantis_tickets_open Current open tickets\n";
        output += "# TYPE promantis_tickets_open gauge\n";
        output += `promantis_tickets_open ${openTickets}\n`;

        output += "# HELP promantis_tickets_closed Total closed tickets\n";
        output += "# TYPE promantis_tickets_closed gauge\n";
        output += `promantis_tickets_closed ${closedTickets}\n`;

        output += "# HELP promantis_users_total Total users\n";
        output += "# TYPE promantis_users_total gauge\n";
        output += `promantis_users_total ${totalUsers}\n`;

        output += "# HELP promantis_active_sessions Current active sessions\n";
        output += "# TYPE promantis_active_sessions gauge\n";
        output += `promantis_active_sessions ${activeUsers}\n`;

        output += "# HELP promantis_comments_total Total comments\n";
        output += "# TYPE promantis_comments_total gauge\n";
        output += `promantis_comments_total ${totalComments}\n`;

        // Tickets by priority
        output += "# HELP promantis_tickets_by_priority Tickets by priority\n";
        output += "# TYPE promantis_tickets_by_priority gauge\n";
        for (const item of ticketsByPriority) {
          output += `promantis_tickets_by_priority{priority="${item.priority || 'none'}"} ${item._count}\n`;
        }

        // Process info
        output += "# HELP promantis_process_uptime_seconds Process uptime in seconds\n";
        output += "# TYPE promantis_process_uptime_seconds gauge\n";
        output += `promantis_process_uptime_seconds ${process.uptime().toFixed(0)}\n`;

        output += "# HELP promantis_process_memory_bytes Process memory usage\n";
        output += "# TYPE promantis_process_memory_bytes gauge\n";
        const memUsage = process.memoryUsage();
        output += `promantis_process_memory_heap_used_bytes ${memUsage.heapUsed}\n`;
        output += `promantis_process_memory_heap_total_bytes ${memUsage.heapTotal}\n`;
        output += `promantis_process_memory_rss_bytes ${memUsage.rss}\n`;

        reply.header("Content-Type", "text/plain; charset=utf-8");
        reply.send(output);
      } catch (error: any) {
        console.error("Error generating metrics:", error);
        reply.status(500).send("Error generating metrics");
      }
    }
  );

  // JSON metrics endpoint for internal use (requires auth)
  fastify.get(
    "/api/v1/admin/prometheus/json",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jsonMetrics = metrics.getJsonMetrics();

        // Add database metrics
        const [totalTickets, openTickets, totalUsers] = await Promise.all([
          prisma.ticket.count(),
          prisma.ticket.count({ where: { isComplete: false } }),
          prisma.user.count(),
        ]);

        reply.send({
          success: true,
          metrics: {
            ...jsonMetrics,
            database: {
              totalTickets,
              openTickets,
              totalUsers,
            },
            process: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
            },
          },
        });
      } catch (error: any) {
        reply.status(500).send({ success: false, error: error.message });
      }
    }
  );
}
