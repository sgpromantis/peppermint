import EmailReplyParser from "email-reply-parser";
import Imap from "imap";
import { simpleParser } from "mailparser";
import { prisma } from "../../prisma";
import { EmailConfig, EmailQueue } from "../types/email";
import { AuthService } from "./auth.service";
import { metrics } from "../prometheus-metrics";
import { sendTicketConfirmation } from "../nodemailer/ticket/confirmation";

function getReplyText(email: any): string {
  const parsed = new EmailReplyParser().read(email.text || "");
  const fragments = parsed.getFragments();

  let replyText = "";

  fragments.forEach((fragment: any) => {
    if (!fragment._isHidden && !fragment._isSignature && !fragment._isQuoted) {
      replyText += fragment._content;
    }
  });

  // If no text was extracted, try to get at least something from the email
  if (!replyText.trim() && email.text) {
    // Take the first paragraph as fallback
    const lines = email.text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(">") && !trimmed.startsWith("On ") && !trimmed.startsWith("Am ")) {
        replyText = trimmed;
        break;
      }
    }
  }

  return replyText.trim() || email.text || "No content";
}

/**
 * Extract ticket ID from various sources in the email
 * Priority: In-Reply-To header > References header > Subject line > X-Ticket-ID header
 */
async function findTicketFromEmail(parsed: any): Promise<{ ticket: any; method: string } | null> {
  const inReplyTo = parsed.inReplyTo;
  const references = parsed.references;
  const subject = parsed.subject || "";
  const headers = parsed.headers;

  // 1. Try In-Reply-To header - most reliable for direct replies
  if (inReplyTo) {
    const ticket = await prisma.ticket.findFirst({
      where: { messageId: inReplyTo },
    });
    if (ticket) {
      console.log(`Found ticket via In-Reply-To header: ${ticket.id}`);
      return { ticket, method: "in-reply-to" };
    }

    // Try to extract ticket ID from the Message-ID format: <ticket-UUID-random@domain>
    const ticketIdMatch = inReplyTo.match(/ticket-([0-9a-f-]{36})/i);
    if (ticketIdMatch) {
      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketIdMatch[1] },
      });
      if (ticket) {
        console.log(`Found ticket via In-Reply-To ticket ID: ${ticket.id}`);
        return { ticket, method: "in-reply-to-id" };
      }
    }
  }

  // 2. Try References header - contains thread history
  if (references) {
    const refArray = Array.isArray(references) ? references : [references];
    for (const ref of refArray) {
      const ticket = await prisma.ticket.findFirst({
        where: { messageId: ref },
      });
      if (ticket) {
        console.log(`Found ticket via References header: ${ticket.id}`);
        return { ticket, method: "references" };
      }

      // Try to extract ticket ID from the Message-ID format
      const ticketIdMatch = ref.match(/ticket-([0-9a-f-]{36})/i);
      if (ticketIdMatch) {
        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketIdMatch[1] },
        });
        if (ticket) {
          console.log(`Found ticket via References ticket ID: ${ticket.id}`);
          return { ticket, method: "references-id" };
        }
      }
    }
  }

  // 3. Try X-Ticket-ID custom header
  const xTicketId = headers?.get("x-ticket-id");
  if (xTicketId) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: xTicketId },
    });
    if (ticket) {
      console.log(`Found ticket via X-Ticket-ID header: ${ticket.id}`);
      return { ticket, method: "x-ticket-id" };
    }
  }

  // 4. Try to extract from subject line with multiple patterns
  const subjectPatterns = [
    // [Ticket #uuid] format
    /\[Ticket\s*#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i,
    // #uuid or ref:uuid format
    /(?:ref:|#)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    // Ticket uuid anywhere in subject
    /ticket[:\s#]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    // Just UUID pattern as last resort
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  ];

  for (const pattern of subjectPatterns) {
    const match = subject.match(pattern);
    if (match) {
      const ticket = await prisma.ticket.findFirst({
        where: { id: match[1] },
      });
      if (ticket) {
        console.log(`Found ticket via subject pattern: ${ticket.id}`);
        return { ticket, method: "subject" };
      }
    }
  }

  return null;
}

/**
 * Check if an email appears to be a reply based on subject and headers
 */
function isEmailReply(parsed: any): boolean {
  const subject = (parsed.subject || "").toLowerCase();
  const hasReplySubject =
    subject.startsWith("re:") ||
    subject.startsWith("aw:") ||     // German
    subject.startsWith("sv:") ||     // Swedish/Norwegian
    subject.startsWith("r:") ||
    subject.startsWith("rép:") ||    // French
    subject.startsWith("res:") ||    // Portuguese
    subject.includes("ref:") ||
    subject.includes("[ticket");

  const hasReplyHeaders = !!(parsed.inReplyTo || parsed.references);

  return hasReplySubject || hasReplyHeaders;
}

export class ImapService {
  private static async getImapConfig(queue: EmailQueue): Promise<EmailConfig> {
    switch (queue.serviceType) {
      case "gmail": {
        const validatedAccessToken = await AuthService.getValidAccessToken(
          queue
        );

        return {
          user: queue.username,
          host: queue.hostname,
          port: 993,
          tls: true,
          xoauth2: AuthService.generateXOAuth2Token(
            queue.username,
            validatedAccessToken
          ),
          tlsOptions: { rejectUnauthorized: false, servername: queue.hostname },
        };
      }
      case "other":
        return {
          user: queue.username,
          password: queue.password,
          host: queue.hostname,
          port: queue.tls ? 993 : 143,
          tls: queue.tls || false,
          tlsOptions: { rejectUnauthorized: false, servername: queue.hostname },
        };
      default:
        throw new Error("Unsupported service type");
    }
  }

  private static async processEmail(
    parsed: any,
    isReplyHint: boolean
  ): Promise<void> {
    const { from, subject, text, html, textAsHtml } = parsed;
    const senderEmail = from?.value?.[0]?.address;
    const senderName = from?.value?.[0]?.name || senderEmail;

    if (!senderEmail) {
      console.error("No sender email found, skipping");
      return;
    }

    // Check if this looks like a reply using multiple methods
    const looksLikeReply = isReplyHint || isEmailReply(parsed);
    console.log(`Processing email from ${senderEmail}, subject: "${subject}", isReply: ${looksLikeReply}`);

    // If it looks like a reply, try to find the original ticket
    if (looksLikeReply) {
      const result = await findTicketFromEmail(parsed);

      if (result) {
        const { ticket, method } = result;
        console.log(`Found ticket ${ticket.id} via ${method}, adding as comment`);

        const replyText = getReplyText(parsed);

        await prisma.comment.create({
          data: {
            text: replyText,
            userId: null,
            ticketId: ticket.id,
            reply: true,
            replyEmail: senderEmail,
            public: true,
          },
        });

        // Track metrics
        metrics.incrementEmailsReceived();
        console.log(`Added reply as comment to ticket ${ticket.id}`);
        return;
      }

      // Fallback: Try to find an open ticket from the same sender
      const recentTicket = await prisma.ticket.findFirst({
        where: {
          email: senderEmail,
          isComplete: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentTicket) {
        console.log(`Found recent open ticket ${recentTicket.id} from same sender, adding as comment`);

        const replyText = getReplyText(parsed);

        await prisma.comment.create({
          data: {
            text: replyText,
            userId: null,
            ticketId: recentTicket.id,
            reply: true,
            replyEmail: senderEmail,
            public: true,
          },
        });

        metrics.incrementEmailsReceived();
        console.log(`Added reply as comment to ticket ${recentTicket.id} (fallback by sender)`);
        return;
      }

      // If no ticket found but it looked like a reply, log and create new ticket
      console.log(`Email looked like reply but no matching ticket found, creating new ticket`);
    }

    // Create new ticket
    const imapEmail = await prisma.imap_Email.create({
      data: {
        from: senderEmail,
        subject: subject || "No Subject",
        body: text || "No Body",
        html: html || "",
        text: textAsHtml,
      },
    });

    const ticket = await prisma.ticket.create({
      data: {
        email: senderEmail,
        name: senderName,
        title: imapEmail.subject || "-",
        isComplete: false,
        priority: "low",
        fromImap: true,
        detail: html || textAsHtml,
      },
    });

    // Track metrics
    metrics.incrementTicketsCreated(true);
    metrics.incrementEmailsReceived();

    // Send confirmation email with ticket link
    try {
      await sendTicketConfirmation(ticket);
    } catch (emailError) {
      console.error("Failed to send ticket confirmation:", emailError);
    }

    console.log(`Created new ticket ${ticket.id} from email`);
  }

  static async fetchEmails(): Promise<void> {
    const queues =
      (await prisma.emailQueue.findMany()) as unknown as EmailQueue[];
    const today = new Date();

    for (const queue of queues) {
      try {
        const imapConfig = await this.getImapConfig(queue);

        if (queue.serviceType === "other" && !imapConfig.password) {
          console.error("IMAP configuration is missing a password");
          throw new Error("IMAP configuration is missing a password");
        }

        // @ts-ignore
        const imap = new Imap(imapConfig);

        await new Promise((resolve, reject) => {
          imap.once("ready", () => {
            imap.openBox("INBOX", false, (err) => {
              if (err) {
                reject(err);
                return;
              }
              imap.search(["UNSEEN", ["ON", today]], (err, results) => {
                if (err) reject(err);
                if (!results?.length) {
                  console.log("No new messages");
                  imap.end();
                  resolve(null);
                  return;
                }

                const fetch = imap.fetch(results, { bodies: "" });

                fetch.on("message", (msg) => {
                  msg.on("body", (stream) => {
                    simpleParser(stream, async (err, parsed) => {
                      if (err) throw err;
                      const subjectLower = parsed.subject?.toLowerCase() || "";
                      const isReply =
                        subjectLower.includes("re:") ||
                        subjectLower.includes("ref:");
                      await this.processEmail(parsed, isReply || false);
                    });
                  });

                  msg.once("attributes", (attrs) => {
                    imap.addFlags(attrs.uid, ["\\Seen"], () => {
                      console.log("Marked as read!");
                    });
                  });
                });

                fetch.once("error", reject);
                fetch.once("end", () => {
                  console.log("Done fetching messages");
                  imap.end();
                  resolve(null);
                });
              });
            });
          });

          imap.once("error", reject);
          imap.once("end", () => {
            console.log("Connection ended");
            resolve(null);
          });

          imap.connect();
        });
      } catch (error) {
        console.error(`Error processing queue ${queue.id}:`, error);
      }
    }
  }
}
