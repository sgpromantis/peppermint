import EmailReplyParser from "email-reply-parser";
import fs from "fs";
import Imap from "imap";
import { simpleParser } from "mailparser";
import path from "path";
import crypto from "crypto";
import { prisma } from "../../prisma";
import { EmailConfig, EmailQueue } from "../types/email";
import { AuthService } from "./auth.service";
import { metrics } from "../prometheus-metrics";
import { sendTicketCreate } from "../nodemailer/ticket/create";
import { PROHIBITED_ADDRESSES } from "../nodemailer/ticket/loop-prevention";
import { getNextTicketNumber } from "../ticket-number";

/**
 * Save email attachments to disk and create TicketFile records.
 * Wrapped in try-catch so attachment failures never kill email processing.
 */
async function saveAttachments(
  attachments: any[],
  ticketId: string,
  userId?: string | null
): Promise<void> {
  if (!attachments || attachments.length === 0) return;

  const uploadsDir = path.resolve("uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  for (const att of attachments) {
    try {
      const uniqueName = `${crypto.randomBytes(12).toString("hex")}-${att.filename || "attachment"}`;
      const filePath = path.join(uploadsDir, uniqueName);

      // att.content is a Buffer from mailparser
      fs.writeFileSync(filePath, att.content);

      await prisma.ticketFile.create({
        data: {
          ticketId,
          filename: att.filename || "attachment",
          path: `uploads/${uniqueName}`,
          mime: att.contentType || "application/octet-stream",
          encoding: att.encoding || "7bit",
          size: att.size || att.content.length,
          userId: userId || null,
        },
      });

      console.log(`[IMAP] Saved attachment "${att.filename}" (${att.size} bytes) for ticket ${ticketId}`);
    } catch (attErr) {
      console.error(`[IMAP] Failed to save attachment "${att.filename}" for ticket ${ticketId}:`, attErr);
    }
  }
}

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

  // 4. Try to extract UUID from subject line with multiple patterns
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
        console.log(`Found ticket via subject UUID pattern: ${ticket.id}`);
        return { ticket, method: "subject-uuid" };
      }
    }
  }

  // 5. Try to match numeric ticket Number from subject line
  // This handles replies like "Re: [Ticket #42] ..." or "Ticket #42 update"
  const numberPatterns = [
    // [Ticket #42] format (most specific)
    /\[Ticket\s*#(\d+)\]/i,
    // Ticket #42 or ticket#42 or Ticket: 42
    /ticket\s*[:#]?\s*(\d+)/i,
  ];

  for (const pattern of numberPatterns) {
    const match = subject.match(pattern);
    if (match) {
      const ticketNumber = parseInt(match[1], 10);
      if (!isNaN(ticketNumber) && ticketNumber > 0) {
        const ticket = await prisma.ticket.findFirst({
          where: { Number: ticketNumber },
        });
        if (ticket) {
          console.log(`Found ticket via subject Number pattern: #${ticketNumber} → ${ticket.id}`);
          return { ticket, method: "subject-number" };
        }
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

  /**
   * Try to extract the original sender from forwarding headers.
   * When an email is forwarded/relayed through a pool/catchall address,
   * the real sender may be in X-Original-From, X-Forwarded-For, or
   * the envelope-from (Return-Path).
   */
  private static extractOriginalSender(parsed: any, imapAddress?: string): {
    email: string;
    name: string;
  } | null {
    const headers = parsed.headers;
    if (!headers) return null;

    // 1. X-Original-From header (set by some forwarders)
    const xOriginalFrom = headers.get("x-original-from");
    if (xOriginalFrom) {
      const match = String(xOriginalFrom).match(/<([^>]+)>/) || 
                    String(xOriginalFrom).match(/([^\s<]+@[^\s>]+)/);
      if (match) {
        console.log(`Found original sender via X-Original-From: ${match[1]}`);
        return { email: match[1].toLowerCase(), name: match[1] };
      }
    }

    // 2. X-Forwarded-To / X-Forwarded-For (Postfix/Poste style)
    const xForwardedFor = headers.get("x-forwarded-for") || headers.get("x-original-sender");
    if (xForwardedFor) {
      const match = String(xForwardedFor).match(/([^\s<]+@[^\s>]+)/);
      if (match) {
        console.log(`Found original sender via X-Forwarded-For: ${match[1]}`);
        return { email: match[1].toLowerCase(), name: match[1] };
      }
    }

    // 3. Sender header (RFC 5322 — set when someone sends on behalf of a shared mailbox)
    const senderHeader = headers.get("sender");
    if (senderHeader) {
      const match = String(senderHeader).match(/<([^>]+)>/) ||
                    String(senderHeader).match(/([^\s<]+@[^\s>]+)/);
      if (match && imapAddress && match[1].toLowerCase() !== imapAddress.toLowerCase()) {
        const senderName = String(senderHeader).match(/^([^<]+)\s*</);
        console.log(`Found original sender via Sender header: ${match[1]}`);
        return { email: match[1].toLowerCase(), name: senderName?.[1]?.trim() || match[1] };
      }
    }

    // 4. Return-Path / envelope-from (often the real sender when forwarded)
    const returnPath = headers.get("return-path");
    if (returnPath) {
      const rpAddr = String(returnPath).match(/<([^>]+)>/)?.[1] || 
                     String(returnPath).match(/([^\s<]+@[^\s>]+)/)?.[1];
      if (rpAddr && imapAddress && rpAddr.toLowerCase() !== imapAddress.toLowerCase()) {
        console.log(`Found original sender via Return-Path: ${rpAddr}`);
        return { email: rpAddr.toLowerCase(), name: rpAddr };
      }
    }

    // 5. Delivered-To might reveal the chain
    const deliveredTo = headers.get("delivered-to");
    if (deliveredTo) {
      // This is usually the recipient, not the sender - skip
    }

    // 6. If Reply-To differs from IMAP address, use it as fallback sender
    const replyTo = parsed.replyTo?.value?.[0]?.address;
    if (replyTo && imapAddress && replyTo.toLowerCase() !== imapAddress.toLowerCase()) {
      console.log(`Using Reply-To as original sender: ${replyTo}`);
      const replyToName = parsed.replyTo?.value?.[0]?.name || replyTo;
      return { email: replyTo.toLowerCase(), name: replyToName };
    }

    return null;
  }

  private static async processEmail(
    parsed: any,
    isReplyHint: boolean
  ): Promise<void> {
    const { from, subject, text, html, textAsHtml } = parsed;
    let senderEmail = from?.value?.[0]?.address?.toLowerCase();
    let senderName = from?.value?.[0]?.name || senderEmail;

    // Extract Reply-To header from the incoming email (if present)
    const emailReplyTo = parsed.replyTo?.value?.[0]?.address?.toLowerCase() || undefined;
    if (emailReplyTo && emailReplyTo !== senderEmail) {
      console.log(`Email has Reply-To header: ${emailReplyTo} (From: ${senderEmail})`);
    }

    if (!senderEmail) {
      console.error("No sender email found, skipping");
      return;
    }

    // Check if the sender is the IMAP mailbox itself (forwarded email)
    // If so, try to find the real sender from forwarding headers
    const activeQueues = await prisma.emailQueue.findMany({ where: { active: true } });
    const imapAddresses = activeQueues.map(q => q.username.toLowerCase());
    
    // Also collect SMTP sender/reply addresses as system addresses
    const smtpConfig = await prisma.email.findFirst({ select: { user: true, reply: true } });
    const systemAddresses = [...imapAddresses, ...PROHIBITED_ADDRESSES.map(a => a.toLowerCase())];
    if (smtpConfig?.user) systemAddresses.push(smtpConfig.user.toLowerCase());
    if (smtpConfig?.reply) systemAddresses.push(smtpConfig.reply.toLowerCase());
    
    if (systemAddresses.includes(senderEmail.toLowerCase())) {
      console.log(`Sender "${senderEmail}" matches a system address — looking for original sender`);
      const originalSender = this.extractOriginalSender(parsed, senderEmail);
      if (originalSender && !systemAddresses.includes(originalSender.email.toLowerCase())) {
        console.log(`Resolved original sender: ${originalSender.email} (was: ${senderEmail})`);
        senderEmail = originalSender.email;
        senderName = originalSender.name;
      } else if (originalSender) {
        console.warn(`Resolved sender ${originalSender.email} is also a system address — keeping ${senderEmail}`);
      } else {
        console.warn(`Could not resolve original sender via headers — attempting name-based user lookup`);
        // Last resort: try to find a user by the display name from the From header.
        // If the email was sent as "Sebastian Gorr <pool@ticket.promantis.de>",
        // the display name might match a real user in the database.
        if (senderName && senderName !== senderEmail) {
          try {
            const userByName = await prisma.user.findFirst({
              where: {
                name: { equals: senderName, mode: "insensitive" },
                email: { not: { in: systemAddresses } },
              },
              select: { email: true, name: true },
            });
            if (userByName) {
              console.log(`Resolved original sender via name lookup: ${userByName.email} (name: "${senderName}")`);
              senderEmail = userByName.email.toLowerCase();
              senderName = userByName.name || senderName;
            } else {
              console.warn(`Name-based lookup for "${senderName}" found no non-system user — keeping ${senderEmail}`);
            }
          } catch (lookupErr) {
            console.error(`[IMAP] Name-based user lookup failed for "${senderName}":`, lookupErr);
          }
        }
      }
    }

    // Check if this looks like a reply using multiple methods
    const looksLikeReply = isReplyHint || isEmailReply(parsed);
    console.log(`Processing email from ${senderEmail}, subject: "${subject}", isReply: ${looksLikeReply}`);

    // ALWAYS try to find a matching ticket via headers or subject patterns.
    // This ensures that emails with [Ticket #42] in the subject are added as comments
    // regardless of whether the email has a Re:/Aw: prefix.
    const result = await findTicketFromEmail(parsed);

    if (result) {
      const { ticket, method } = result;
      console.log(`Found ticket ${ticket.id} (Number: ${ticket.Number}) via ${method}, adding as comment`);

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

      // Save any attachments from the reply email
      await saveAttachments(parsed.attachments || [], ticket.id, null);

      return;
    }

    // Fallback for reply-like emails: try to find an open ticket from the same sender
    if (looksLikeReply) {
      const recentTicket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { email: senderEmail },
            { replyTo: senderEmail },
          ],
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

        // Save any attachments from the reply email
        await saveAttachments(parsed.attachments || [], recentTicket.id, null);

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

    // Look up user by email address for display name and client linking
    const existingUser = await prisma.user.findUnique({
      where: { email: senderEmail.toLowerCase() },
      include: { client: true },
    });

    // Also try matching by Reply-To if direct match failed
    let matchedUser = existingUser || (emailReplyTo ? await prisma.user.findUnique({
      where: { email: emailReplyTo.toLowerCase() },
      include: { client: true },
    }) : null);

    // If still no match and senderName differs from senderEmail, try name-based lookup
    if (!matchedUser && senderName && senderName !== senderEmail) {
      try {
        matchedUser = await prisma.user.findFirst({
          where: { name: { equals: senderName, mode: "insensitive" } },
          include: { client: true },
        });
        if (matchedUser) {
          console.log(`Matched user "${matchedUser.name}" (${matchedUser.email}) via name lookup`);
        }
      } catch (lookupErr) {
        console.error(`[IMAP] Name-based user lookup (ticket creation) failed for "${senderName}":`, lookupErr);
      }
    }

    // CRITICAL: If senderEmail is still a system/prohibited address but we found a real user
    // with a different email, override senderEmail so the ticket gets the correct address
    // and confirmation emails are sent to the right person.
    if (matchedUser && matchedUser.email.toLowerCase() !== senderEmail.toLowerCase()
        && systemAddresses.includes(senderEmail.toLowerCase())) {
      console.log(`Overriding senderEmail from system address ${senderEmail} → ${matchedUser.email} (matched user)`);
      senderEmail = matchedUser.email.toLowerCase();
    }

    // Determine display name: use matched user's name, or fall back to sender name
    const displayName = matchedUser?.name || senderName;

    // Determine if this is an internal user or external/unknown
    const isInternal = matchedUser ? !matchedUser.external_user : false;
    const userType = matchedUser 
      ? (matchedUser.external_user ? "external" : (matchedUser.isAdmin ? "admin" : (matchedUser.isManager ? "manager" : "internal")))
      : "unknown";

    // Auto-detect client: first try user's linked client, then match by email domain
    let detectedClientId: string | undefined = matchedUser?.clientId || undefined;

    if (!detectedClientId) {
      const domain = senderEmail.split("@")[1]?.toLowerCase();
      if (domain) {
        const clientByDomain = await prisma.client.findFirst({
          where: { domains: { has: domain } },
        });
        if (clientByDomain) {
          detectedClientId = clientByDomain.id;
          console.log(`Auto-linked client "${clientByDomain.name}" via domain "${domain}"`);
        }
      }
    } else {
      console.log(`Auto-linked client "${matchedUser?.client?.name}" via user "${matchedUser?.email}"`);
    }

    // If user is found but not linked to a client, auto-link them
    if (matchedUser && !matchedUser.clientId && detectedClientId) {
      await prisma.user.update({
        where: { id: matchedUser.id },
        data: { clientId: detectedClientId },
      });
      console.log(`Auto-linked user "${matchedUser.email}" to client via domain detection`);
    }

    const nextNumber = await getNextTicketNumber();

    // Build createdBy metadata for internal user tracking
    const createdByInfo = matchedUser ? {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: userType,
    } : undefined;

    const ticket = await prisma.ticket.create({
      data: {
        Number: nextNumber,
        email: senderEmail,
        replyTo: emailReplyTo || undefined,
        name: displayName,
        title: imapEmail.subject || "-",
        isComplete: false,
        priority: "low",
        fromImap: true,
        detail: html || textAsHtml,
        clientId: detectedClientId || undefined,
        createdBy: createdByInfo || undefined,
      },
    });

    console.log(`Created ticket ${ticket.id} | sender: ${senderEmail} | user: ${matchedUser?.email || "unknown"} | type: ${userType} | client: ${detectedClientId || "none"}`);

    // Track metrics
    metrics.incrementTicketsCreated(true);
    metrics.incrementEmailsReceived();

    // Save any email attachments to the new ticket
    await saveAttachments(parsed.attachments || [], ticket.id, matchedUser?.id || null);

    // Loop prevention: only send confirmation/create emails if the resolved sender
    // is NOT one of our own system addresses (IMAP queues, SMTP sender, etc.)
    // This prevents infinite loops when a forwarder address is detected as the sender.
    const isSysAddr = systemAddresses.includes(senderEmail.toLowerCase());
    if (isSysAddr) {
      console.warn(`[IMAP Loop Prevention] Skipping outgoing emails — resolved sender ${senderEmail} is still a system address`);
    } else {
      try {
        await sendTicketCreate(ticket);
      } catch (emailError) {
        console.error("Failed to send ticket emails:", emailError);
      }
    }
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
                      if (err) {
                        console.error("[IMAP] Failed to parse email:", err);
                        return;
                      }
                      try {
                        const subjectLower = parsed.subject?.toLowerCase() || "";
                        const isReply =
                          subjectLower.includes("re:") ||
                          subjectLower.includes("ref:");
                        await this.processEmail(parsed, isReply || false);
                      } catch (processError) {
                        console.error(`[IMAP] CRITICAL: processEmail failed for subject "${parsed.subject}", from "${parsed.from?.value?.[0]?.address}":`, processError);
                      }
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
