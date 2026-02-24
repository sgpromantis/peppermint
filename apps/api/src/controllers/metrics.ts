import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";

export function metricsRoutes(fastify: FastifyInstance) {
  // Admin or Manager middleware check
  const requireAdminOrManager = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await checkSession(request);
    const canAccess = user?.isAdmin || user?.isManager;
    if (!canAccess) {
      reply.status(403).send({ error: "Admin or Manager access required" });
      return;
    }
  };

  // Get comprehensive ticket metrics for admin dashboard
  fastify.get(
    "/api/v1/admin/metrics",
    { preHandler: requireAdminOrManager },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();
      
      // Time period boundaries
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Get all tickets for metrics calculation
      const allTickets = await prisma.ticket.findMany({
        where: { hidden: false },
        include: {
          Comment: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          assignedTo: {
            select: { id: true, name: true },
          },
        },
      });

      // Tickets per time period
      const ticketsThisWeek = allTickets.filter((t: typeof allTickets[number]) => new Date(t.createdAt) >= startOfWeek).length;
      const ticketsThisMonth = allTickets.filter((t: typeof allTickets[number]) => new Date(t.createdAt) >= startOfMonth).length;
      const ticketsThisQuarter = allTickets.filter((t: typeof allTickets[number]) => new Date(t.createdAt) >= startOfQuarter).length;
      const ticketsThisYear = allTickets.filter((t: typeof allTickets[number]) => new Date(t.createdAt) >= startOfYear).length;

      // Calculate average assignment time (time from creation to assignment)
      const assignedTickets = allTickets.filter((t: typeof allTickets[number]) => t.userId !== null);
      let totalAssignmentTime = 0;
      let assignmentCount = 0;
      
      for (const ticket of assignedTickets) {
        // Use updatedAt as proxy for assignment time if assigned
        const createdAt = new Date(ticket.createdAt).getTime();
        const updatedAt = new Date(ticket.updatedAt).getTime();
        if (updatedAt > createdAt) {
          totalAssignmentTime += (updatedAt - createdAt);
          assignmentCount++;
        }
      }
      
      const avgAssignmentTimeMs = assignmentCount > 0 ? totalAssignmentTime / assignmentCount : 0;
      const avgAssignmentTimeHours = Math.round(avgAssignmentTimeMs / (1000 * 60 * 60) * 10) / 10;

      // Calculate average first response time
      const ticketsWithComments = allTickets.filter((t: typeof allTickets[number]) => t.Comment.length > 0);
      let totalResponseTime = 0;
      let responseCount = 0;
      
      for (const ticket of ticketsWithComments) {
        const createdAt = new Date(ticket.createdAt).getTime();
        const firstCommentAt = new Date(ticket.Comment[0].createdAt).getTime();
        totalResponseTime += (firstCommentAt - createdAt);
        responseCount++;
      }
      
      const avgResponseTimeMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
      const avgResponseTimeHours = Math.round(avgResponseTimeMs / (1000 * 60 * 60) * 10) / 10;

      // Calculate average resolution time (for completed tickets)
      const completedTickets = allTickets.filter((t: typeof allTickets[number]) => t.isComplete);
      let totalResolutionTime = 0;
      let resolutionCount = 0;
      
      for (const ticket of completedTickets) {
        const createdAt = new Date(ticket.createdAt).getTime();
        const updatedAt = new Date(ticket.updatedAt).getTime();
        totalResolutionTime += (updatedAt - createdAt);
        resolutionCount++;
      }
      
      const avgResolutionTimeMs = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0;
      const avgResolutionTimeHours = Math.round(avgResolutionTimeMs / (1000 * 60 * 60) * 10) / 10;

      // Tickets by priority
      const ticketsByPriority = {
        low: allTickets.filter((t: typeof allTickets[number]) => t.priority === "low").length,
        normal: allTickets.filter((t: typeof allTickets[number]) => t.priority === "normal").length,
        high: allTickets.filter((t: typeof allTickets[number]) => t.priority === "high").length,
      };

      // Tickets by status
      const ticketsByStatus = {
        needs_support: allTickets.filter((t: typeof allTickets[number]) => t.status === "needs_support").length,
        in_progress: allTickets.filter((t: typeof allTickets[number]) => t.status === "in_progress").length,
        in_review: allTickets.filter((t: typeof allTickets[number]) => t.status === "in_review").length,
        done: allTickets.filter((t: typeof allTickets[number]) => t.status === "done").length,
      };

      // Tickets by type
      const ticketsByType = {
        support: allTickets.filter((t: typeof allTickets[number]) => t.type === "support").length,
        bug: allTickets.filter((t: typeof allTickets[number]) => t.type === "bug").length,
        feature: allTickets.filter((t: typeof allTickets[number]) => t.type === "feature").length,
        incident: allTickets.filter((t: typeof allTickets[number]) => t.type === "incident").length,
        service: allTickets.filter((t: typeof allTickets[number]) => t.type === "service").length,
        maintenance: allTickets.filter((t: typeof allTickets[number]) => t.type === "maintenance").length,
        access: allTickets.filter((t: typeof allTickets[number]) => t.type === "access").length,
      };

      // User workload (tickets per user)
      const userWorkload: { [key: string]: { name: string; open: number; total: number } } = {};
      for (const ticket of allTickets) {
        if (ticket.assignedTo) {
          const userId = ticket.assignedTo.id;
          if (!userWorkload[userId]) {
            userWorkload[userId] = { name: ticket.assignedTo.name, open: 0, total: 0 };
          }
          userWorkload[userId].total++;
          if (!ticket.isComplete) {
            userWorkload[userId].open++;
          }
        }
      }

      // Open vs closed ratio
      const openTickets = allTickets.filter((t: typeof allTickets[number]) => !t.isComplete).length;
      const closedTickets = completedTickets.length;

      // Unassigned tickets
      const unassignedTickets = allTickets.filter((t: typeof allTickets[number]) => t.userId === null && !t.isComplete).length;

      // Resolution rate (percentage of tickets resolved)
      const resolutionRate = allTickets.length > 0 
        ? Math.round((closedTickets / allTickets.length) * 100) 
        : 0;

      reply.send({
        success: true,
        metrics: {
          // Time-based volumes
          ticketsThisWeek,
          ticketsThisMonth,
          ticketsThisQuarter,
          ticketsThisYear,
          totalTickets: allTickets.length,
          
          // Performance metrics (in hours)
          avgAssignmentTimeHours,
          avgResponseTimeHours,
          avgResolutionTimeHours,
          
          // Current state
          openTickets,
          closedTickets,
          unassignedTickets,
          resolutionRate,
          
          // Breakdowns
          ticketsByPriority,
          ticketsByStatus,
          ticketsByType,
          
          // User metrics
          userWorkload: Object.values(userWorkload).sort((a, b) => b.open - a.open),
        },
      });
    }
  );

  // Get ticket trend data (daily counts for the last 30 days)
  fastify.get(
    "/api/v1/admin/metrics/trends",
    { preHandler: requireAdminOrManager },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const tickets = await prisma.ticket.findMany({
        where: {
          hidden: false,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          isComplete: true,
        },
      });

      // Group by day
      const dailyData: { [key: string]: { created: number; completed: number } } = {};
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        dailyData[key] = { created: 0, completed: 0 };
      }
      
      for (const ticket of tickets) {
        const key = new Date(ticket.createdAt).toISOString().split("T")[0];
        if (dailyData[key]) {
          dailyData[key].created++;
        }
      }

      // Get completed tickets in last 30 days
      const completedTickets = await prisma.ticket.findMany({
        where: {
          hidden: false,
          isComplete: true,
          updatedAt: { gte: thirtyDaysAgo },
        },
        select: {
          updatedAt: true,
        },
      });

      for (const ticket of completedTickets) {
        const key = new Date(ticket.updatedAt).toISOString().split("T")[0];
        if (dailyData[key]) {
          dailyData[key].completed++;
        }
      }

      // Convert to array sorted by date
      const trends = Object.entries(dailyData)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      reply.send({
        success: true,
        trends,
      });
    }
  );
}
