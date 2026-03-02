import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import axios from "axios";
import { checkToken } from "../lib/jwt";
import { getNextTicketNumber, resetTicketNumberSequence } from "../lib/ticket-number";

//@ts-ignore
import { track } from "../lib/hog";
import { sendAssignedEmail } from "../lib/nodemailer/ticket/assigned";
import { sendComment } from "../lib/nodemailer/ticket/comment";
import { sendTicketCreate } from "../lib/nodemailer/ticket/create";
import { sendTicketStatus } from "../lib/nodemailer/ticket/status";
import { assignedNotification } from "../lib/notifications/issue/assigned";
import { commentNotification } from "../lib/notifications/issue/comment";
import { priorityNotification } from "../lib/notifications/issue/priority";
import {
  activeStatusNotification,
  statusUpdateNotification,
} from "../lib/notifications/issue/status";
import { sendWebhookNotification } from "../lib/notifications/webhook";
import { requirePermission } from "../lib/roles";
import { checkSession } from "../lib/session";
import { prisma } from "../prisma";
import { TicketType } from "@prisma/client";

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

// Valid TicketType enum values
const VALID_TICKET_TYPES = [
  "bug", "feature", "support", "incident",
  "service", "maintenance", "access", "feedback",
];

// Map localized (German) type names to Prisma enum values
const TYPE_ALIASES: Record<string, string> = {
  vorfall: "incident",
  fehler: "bug",
  wartung: "maintenance",
  zugriff: "access",
};

function normalizeTicketType(raw?: string): TicketType {
  if (!raw) return "support" as TicketType;
  const lower = raw.toLowerCase();
  if (VALID_TICKET_TYPES.includes(lower)) return lower as TicketType;
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower] as TicketType;
  return "support" as TicketType; // fallback for unknown values
}

export function ticketRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/v1/ticket/create",
    {
      preHandler: requirePermission(["issue::create"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        name,
        company,
        detail,
        title,
        priority,
        email,
        engineer,
        type,
        createdBy,
        replyTo,
      }: any = request.body;

      const user = await checkSession(request);

      const nextNumber = await getNextTicketNumber();

      const ticket: any = await prisma.ticket.create({
        data: {
          Number: nextNumber,
          name,
          title,
          detail: JSON.stringify(detail),
          priority: priority ? priority : "low",
          email,
          replyTo: replyTo || undefined,
          type: normalizeTicketType(type),
          createdBy: createdBy
            ? {
                id: createdBy.id,
                name: createdBy.name,
                role: createdBy.role,
                email: createdBy.email,
              }
            : undefined,
          client:
            company !== undefined
              ? {
                  connect: { id: company.id || company },
                }
              : undefined,
          fromImap: false,
          assignedTo:
            engineer && engineer.name !== "Unassigned"
              ? {
                  connect: { id: engineer.id },
                }
              : undefined,
          isComplete: Boolean(false),
        },
      });

      // Use replyTo address if available (for forwarded tickets from n8n)
      const recipientEmail = ticket.replyTo || ticket.email;

      if (recipientEmail && validateEmail(recipientEmail)) {
        await sendTicketCreate({ ...ticket, email: recipientEmail });
      }

      if (engineer && engineer.name !== "Unassigned") {
        const assgined = await prisma.user.findUnique({
          where: {
            id: ticket.userId,
          },
        });

        await sendAssignedEmail(assgined!.email, ticket.id, ticket.title, ticket.Number);

        await assignedNotification(engineer, ticket, user);
      }

      const webhook = await prisma.webhooks.findMany({
        where: {
          type: "ticket_created",
        },
      });

      for (let i = 0; i < webhook.length; i++) {
        if (webhook[i].active === true) {
          const message = {
            event: "ticket_created",
            id: ticket.id,
            title: ticket.title,
            priority: ticket.priority,
            email: ticket.email,
            name: ticket.name,
            type: ticket.type,
            createdBy: ticket.createdBy,
            assignedTo: ticket.assignedTo,
            client: ticket.client,
          };

          await sendWebhookNotification(webhook[i], message);
        }
      }

      const hog = track();

      hog.capture({
        event: "ticket_created",
        distinctId: ticket.id,
      });

      reply.status(200).send({
        message: "Ticket created correctly",
        success: true,
        id: ticket.id,
      });
    }
  );

  fastify.post(
    "/api/v1/ticket/public/create",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        name,
        company,
        detail,
        title,
        priority,
        email,
        engineer,
        type,
        createdBy,
        replyTo,
      }: any = request.body;

      // Security: Validate email exists as a user in the system
      let existingUser: any = null;
      if (email) {
        existingUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { client: true },
        });

        if (!existingUser) {
          return reply.code(403).send({
            success: false,
            message: "Zugriff verweigert: E-Mail-Adresse ist nicht registriert. Bitte kontaktieren Sie den Administrator.",
          });
        }
      }

      // Auto-detect client: use provided company, or user's linked client, or match by email domain
      let resolvedClientConnect: any = undefined;
      if (company !== undefined) {
        resolvedClientConnect = { connect: { id: company.id || company } };
      } else if (existingUser?.clientId) {
        resolvedClientConnect = { connect: { id: existingUser.clientId } };
      } else if (email) {
        const domain = email.split("@")[1]?.toLowerCase();
        if (domain) {
          const clientByDomain = await prisma.client.findFirst({
            where: { domains: { has: domain } },
          });
          if (clientByDomain) {
            resolvedClientConnect = { connect: { id: clientByDomain.id } };
          }
        }
      }

      // Use existing user's display name if available and no name was provided
      const resolvedName = name || existingUser?.name || email;

      const nextNumber = await getNextTicketNumber();

      const ticket: any = await prisma.ticket.create({
        data: {
          Number: nextNumber,
          name: resolvedName,
          title,
          detail: JSON.stringify(detail),
          priority: priority ? priority : "low",
          email,
          replyTo: replyTo || undefined,
          type: normalizeTicketType(type),
          createdBy: createdBy
            ? {
                id: createdBy.id,
                name: createdBy.name,
                role: createdBy.role,
                email: createdBy.email,
              }
            : undefined,
          client: resolvedClientConnect,
          fromImap: false,
          assignedTo:
            engineer && engineer.name !== "Unassigned"
              ? {
                  connect: { id: engineer.id },
                }
              : undefined,
          isComplete: Boolean(false),
        },
      });

      // Use replyTo address if available (for forwarded tickets from n8n)
      const recipientEmail = ticket.replyTo || ticket.email;

      if (recipientEmail && validateEmail(recipientEmail)) {
        await sendTicketCreate({ ...ticket, email: recipientEmail });
      }

      if (engineer && engineer.name !== "Unassigned") {
        const assgined = await prisma.user.findUnique({
          where: {
            id: ticket.userId,
          },
        });

        await sendAssignedEmail(assgined!.email, ticket.id, ticket.title, ticket.Number);

        const user = await checkSession(request);

        await assignedNotification(engineer, ticket, user);
      }

      const webhook = await prisma.webhooks.findMany({
        where: {
          type: "ticket_created",
        },
      });

      for (let i = 0; i < webhook.length; i++) {
        if (webhook[i].active === true) {
          const message = {
            event: "ticket_created",
            id: ticket.id,
            title: ticket.title,
            priority: ticket.priority,
            email: ticket.email,
            replyTo: ticket.replyTo,
            name: ticket.name,
            type: ticket.type,
            createdBy: ticket.createdBy,
            assignedTo: ticket.assignedTo,
            client: ticket.client,
          };

          await sendWebhookNotification(webhook[i], message);
        }
      }

      const hog = track();

      hog.capture({
        event: "ticket_created",
        distinctId: ticket.id,
      });

      reply.status(200).send({
        message: "Ticket created correctly",
        success: true,
        id: ticket.id,
      });
    }
  );

  // Get a ticket by id - requires auth
  fastify.get(
    "/api/v1/ticket/:id",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: id,
        },
        include: {
          client: {
            select: { id: true, name: true, number: true, notes: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
        },
      });

      const timeTracking = await prisma.timeTracking.findMany({
        where: {
          ticketId: id,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      const comments = await prisma.comment.findMany({
        where: {
          ticketId: ticket!.id,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      const files = await prisma.ticketFile.findMany({
        where: {
          ticketId: id,
        },
      });

      var t = {
        ...ticket,
        comments: [...comments],
        TimeTracking: [...timeTracking],
        files: [...files],
      };

      reply.send({
        ticket: t,
        sucess: true,
      });
    }
  );

  // Get all tickets - requires auth
  fastify.get(
    "/api/v1/tickets/open",
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

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Basic Search - requires auth
  fastify.post(
    "/api/v1/tickets/search",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { query }: any = request.body;

      const tickets = await prisma.ticket.findMany({
        where: {
          title: {
            contains: query,
          },
        },
      });

      reply.send({
        tickets: tickets,
        success: true,
      });
    }
  );

  // Get all tickets (admin sees all, non-admin sees only their own)
  fastify.get(
    "/api/v1/tickets/all",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Admins and Managers can see all tickets, regular users only their own
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { hidden: false }
        : { hidden: false, userId: user?.id };

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Get all open tickets for a user
  fastify.get(
    "/api/v1/tickets/user/open",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);

      const tickets = await prisma.ticket.findMany({
        where: { isComplete: false, userId: user!.id, hidden: false },
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Get all closed tickets
  fastify.get(
    "/api/v1/tickets/completed",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Admins and Managers can see all tickets, regular users only their own
      const canSeeAll = user?.isAdmin || user?.isManager;
      const whereClause = canSeeAll
        ? { isComplete: true, hidden: false }
        : { isComplete: true, hidden: false, userId: user?.id };

      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Get all unassigned tickets
  fastify.get(
    "/api/v1/tickets/unassigned",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      
      // Only Admins and Managers can see unassigned tickets
      const canSeeAll = user?.isAdmin || user?.isManager;
      if (!canSeeAll) {
        reply.send({
          success: true,
          tickets: [],
        });
        return;
      }

      const tickets = await prisma.ticket.findMany({
        where: {
          isComplete: false,
          assignedTo: null,
          hidden: false,
        },
      });

      reply.send({
        success: true,
        tickets: tickets,
      });
    }
  );

  // Update a ticket
  fastify.put(
    "/api/v1/ticket/update",
    {
      preHandler: requirePermission(["issue::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, note, detail, title, priority, status, client }: any =
        request.body;

      const user = await checkSession(request);

      const issue = await prisma.ticket.findUnique({
        where: { id: id },
      });

      await prisma.ticket.update({
        where: { id: id },
        data: {
          detail,
          note,
          title,
          priority,
          status,
        },
      });

      if (priority && issue!.priority !== priority) {
        await priorityNotification(issue, user, issue!.priority, priority);
      }

      if (status && issue!.status !== status) {
        await statusUpdateNotification(issue, user, status);
      }

      reply.send({
        success: true,
      });
    }
  );

  // Transfer a ticket to another user
  fastify.post(
    "/api/v1/ticket/transfer",
    {
      preHandler: requirePermission(["issue::transfer"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { user, id }: any = request.body;

      const assigner = await checkSession(request);

      if (user) {
        const assigned = await prisma.user.update({
          where: { id: user },
          data: {
            tickets: {
              connect: {
                id: id,
              },
            },
          },
        });

        const { email } = assigned;

        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        await sendAssignedEmail(email, ticket!.id, ticket!.title, ticket!.Number);
        await assignedNotification(assigned, ticket, assigner);
      } else {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            userId: null,
          },
        });
      }

      reply.send({
        success: true,
      });
    }
  );

  // Transfer an Issue to another client
  fastify.post(
    "/api/v1/ticket/transfer/client",
    {
      preHandler: requirePermission(["issue::transfer"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { client, id }: any = request.body;

      if (client) {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            clientId: client,
          },
        });
      } else {
        await prisma.ticket.update({
          where: { id: id },
          data: {
            clientId: null,
          },
        });
      }

      reply.send({
        success: true,
      });
    }
  );

  // Link a ticket to another ticket

  // fastify.post(
  //   "/api/v1/ticket/link",

  //   async (request: FastifyRequest, reply: FastifyReply) => {
  //     const { ticket, id }: any = request.body;

  //     const prev: any = await prisma.ticket.findUnique({
  //       where: {
  //         id: id,
  //       },
  //     });

  //     const ids = [];

  //     if (prev.length !== undefined && prev.linked.length > 0) {
  //       ids.push(...prev.linked);
  //     }

  //     ids.push({
  //       id: ticket.id,
  //       title: ticket.title,
  //     });

  //     const data = await prisma.ticket.update({
  //       where: {
  //         id: id,
  //       },
  //       data: {
  //         linked: {
  //           ...ids,
  //         },
  //       },
  //     });
  //   }
  // );

  // Unlink a ticket from another ticket
  // fastify.post(
  //   "/api/v1/ticket/unlink",

  //   async (request: FastifyRequest, reply: FastifyReply) => {}
  // );

  // Comment on a ticket
  fastify.post(
    "/api/v1/ticket/comment",
    {
      preHandler: requirePermission(["issue::comment"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { text, id, public: public_comment }: any = request.body;

      const user = await checkSession(request);

      await prisma.comment.create({
        data: {
          text: text,
          public: public_comment,
          ticketId: id,
          userId: user!.id,
        },
      });

      const ticket = await prisma.ticket.findUnique({
        where: {
          id: id,
        },
      });

      if (!ticket) {
        return reply.code(404).send({ message: "Ticket not found" });
      }

      const { email, title, replyTo } = ticket;
      // Use replyTo address if available (for forwarded tickets from n8n)
      const ticketRecipient = replyTo || email;
      if (public_comment && ticketRecipient) {
        sendComment(text, title, ticket.id, ticketRecipient);
      }

      // Notify assigned engineer about the comment via email
      if (ticket.userId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: ticket.userId },
        });
        if (assignedUser?.email && assignedUser.id !== user!.id) {
          sendComment(text, title, ticket.id, assignedUser.email);
        }
      }

      await commentNotification(ticket, user);

      const hog = track();

      hog.capture({
        event: "ticket_comment",
        distinctId: ticket!.id,
      });

      reply.send({
        success: true,
      });
    }
  );

  fastify.post(
    "/api/v1/ticket/comment/delete",
    {
      preHandler: requirePermission(["issue::comment"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.body;

      await prisma.comment.delete({
        where: {
          id: id,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Update status of a ticket
  fastify.put(
    "/api/v1/ticket/status/update",
    {
      preHandler: requirePermission(["issue::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { status, id }: any = request.body;

      const user = await checkSession(request);

      const ticket: any = await prisma.ticket.update({
        where: { id: id },
        data: {
          isComplete: status,
        },
      });

      await activeStatusNotification(ticket, user, status);

      await sendTicketStatus(ticket);

      const webhook = await prisma.webhooks.findMany({
        where: {
          type: "ticket_status_changed",
        },
      });

      for (let i = 0; i < webhook.length; i++) {
        const url = webhook[i].url;

        if (webhook[i].active === true) {
          const s = status ? "Completed" : "Outstanding";
          if (url.includes("discord.com")) {
            const message = {
              content: `Ticket ${ticket.id} created by ${ticket.email}, has had it's status changed to ${s}`,
              avatar_url:
                "https://avatars.githubusercontent.com/u/76014454?s=200&v=4",
              username: "Peppermint.sh",
            };
            axios
              .post(url, message)
              .then((response) => {
                console.log("Message sent successfully!");
                console.log("Discord API response:", response.data);
              })
              .catch((error) => {
                console.error("Error sending message:", error);
              });
          } else {
            await axios.post(`${webhook[i].url}`, {
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data: `Ticket ${ticket.id} created by ${ticket.email}, has had it's status changed to ${s}`,
              }),
            });
          }
        }
      }

      reply.send({
        success: true,
      });
    }
  );

  // Hide a ticket
  fastify.put(
    "/api/v1/ticket/status/hide",
    {
      preHandler: requirePermission(["issue::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { hidden, id }: any = request.body;

      await prisma.ticket.update({
        where: { id: id },
        data: {
          hidden: hidden,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Lock a ticket
  fastify.put(
    "/api/v1/ticket/status/lock",
    {
      preHandler: requirePermission(["issue::update"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { locked, id }: any = request.body;

      await prisma.ticket.update({
        where: { id: id },
        data: {
          locked: locked,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Delete a ticket
  fastify.post(
    "/api/v1/ticket/delete",
    {
      preHandler: requirePermission(["issue::delete"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.body;

      await prisma.ticket.delete({
        where: { id: id },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Get all tickets that created via imap
  fastify.get(
    "/api/v1/tickets/imap/all",

    async (request: FastifyRequest, reply: FastifyReply) => {}
  );

  // GET all ticket templates
  fastify.get(
    "/api/v1/ticket/templates",
    {
      preHandler: requirePermission(["email_template::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const templates = await prisma.emailTemplate.findMany({
        select: {
          createdAt: true,
          updatedAt: true,
          type: true,
          id: true,
        },
      });

      reply.send({
        success: true,
        templates: templates,
      });
    }
  );

  // GET ticket template by ID
  fastify.get(
    "/api/v1/ticket/template/:id",
    {
      preHandler: requirePermission(["email_template::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;

      const template = await prisma.emailTemplate.findMany({
        where: {
          id: id,
        },
      });

      reply.send({
        success: true,
        template: template,
      });
    }
  );

  // PUT ticket template by ID
  fastify.put(
    "/api/v1/ticket/template/:id",
    {
      preHandler: requirePermission(["email_template::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;

      const { html }: any = request.body;

      await prisma.emailTemplate.update({
        where: {
          id: id,
        },
        data: {
          html: html,
        },
      });

      reply.send({
        success: true,
      });
    }
  );

  // Get all open tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/open/external",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);

      const tickets = await prisma.ticket.findMany({
        where: { isComplete: false, email: user!.email, hidden: false },
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Get all closed tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/closed/external",

    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);

      const tickets = await prisma.ticket.findMany({
        where: { isComplete: true, email: user!.email, hidden: false },
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Get all tickets for an external user
  fastify.get(
    "/api/v1/tickets/user/external",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);

      const tickets = await prisma.ticket.findMany({
        where: { email: user!.email, hidden: false },
        include: {
          client: {
            select: { id: true, name: true, number: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      });

      reply.send({
        tickets: tickets,
        sucess: true,
      });
    }
  );

  // Subscribe to a ticket
  fastify.get(
    "/api/v1/ticket/subscribe/:id",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;

      const user = await checkSession(request);

      if (id) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        const following = ticket?.following as string[];

        if (following.includes(user!.id)) {
          reply.send({
            success: false,
            message: "You are already following this issue",
          });
        }

        if (ticket) {
          await prisma.ticket.update({
            where: { id: id },
            data: {
              following: [...following, user!.id],
            },
          });
        } else {
          reply.status(400).send({
            success: false,
            message: "No ticket ID provided",
          });
        }

        reply.send({
          success: true,
        });
      }
    }
  );

  // Unsubscribe from a ticket
  fastify.get(
    "/api/v1/ticket/unsubscribe/:id",
    {
      preHandler: requirePermission(["issue::read"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id }: any = request.params;
      const user = await checkSession(request);

      if (id) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: id },
        });

        const following = ticket?.following as string[];

        if (!following.includes(user!.id)) {
          return reply.send({
            success: false,
            message: "You are not following this issue",
          });
        }

        if (ticket) {
          await prisma.ticket.update({
            where: { id: id },
            data: {
              following: following.filter((userId) => userId !== user!.id),
            },
          });
        } else {
          return reply.status(400).send({
            success: false,
            message: "No ticket ID provided",
          });
        }

        reply.send({
          success: true,
        });
      }
    }
  );

  // Admin endpoint to reset ticket number sequence
  fastify.post(
    "/api/v1/ticket/reset-number-sequence",
    {
      preHandler: requirePermission(["settings::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await resetTicketNumberSequence();

        reply.send({
          success: true,
          message: `Ticketnummern-Sequenz zurückgesetzt. Höchste Nummer: ${result.maxNumber}`,
          maxNumber: result.maxNumber,
        });
      } catch (error) {
        console.error("Failed to reset ticket number sequence:", error);
        reply.status(500).send({
          success: false,
          message: "Fehler beim Zurücksetzen der Ticketnummern-Sequenz",
        });
      }
    }
  );

  // Get current ticket number info
  fastify.get(
    "/api/v1/ticket/number-info",
    {
      preHandler: requirePermission(["settings::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await prisma.ticket.aggregate({
          _max: { Number: true },
          _count: { Number: true },
        });

        reply.send({
          success: true,
          maxNumber: result._max.Number ?? 0,
          totalTickets: result._count.Number,
          nextNumber: (result._max.Number ?? 0) + 1,
        });
      } catch (error) {
        console.error("Failed to get ticket number info:", error);
        reply.status(500).send({
          success: false,
          message: "Fehler beim Abrufen der Ticketnummern-Info",
        });
      }
    }
  );
}
