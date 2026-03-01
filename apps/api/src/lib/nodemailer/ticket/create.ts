import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { randomUUID } from "crypto";
import { metrics } from "../../prometheus-metrics";
import { InstanceConfigService } from "../../services/instance-config.service";
import { isSystemAddress } from "./loop-prevention";

export async function sendTicketCreate(ticket: any) {
  try {
    // Loop prevention: never send ticket-create notification to a system-monitored address
    if (await isSystemAddress(ticket.email)) {
      console.log(`[sendTicketCreate] Skipped — recipient ${ticket.email} is a system address`);
      return;
    }

    const email = await prisma.email.findFirst();

    if (email) {
      const transport = await createTransportProvider();

      // Look up the IMAP queue address for Reply-To so replies go to the monitored mailbox
      const imapQueue = await prisma.emailQueue.findFirst({ where: { active: true } });

      // Build ticket URL from instance config (database-first) or environment variables
      const baseUrl = await InstanceConfigService.getTicketPortalUrl();
      const ticketUrl = `${baseUrl}/issue/${ticket.id}`;

      // Generate a unique Message-ID for threading
      const domain = email.reply?.split("@")[1] || "helpdesk.local";
      const messageId = `<ticket-create-${ticket.id}-${randomUUID()}@${domain}>`;

      const testhtml = await prisma.emailTemplate.findFirst({
        where: {
          type: "ticket_created",
        },
      });

      let htmlToSend: string;

      if (testhtml?.html) {
        var template = handlebars.compile(testhtml.html);
        var replacements = {
          id: ticket.id,
          title: ticket.title,
          ticketUrl: ticketUrl,
          createdAt: new Date(ticket.createdAt).toLocaleString("de-DE"),
        };
        htmlToSend = template(replacements);
      } else {
        // Default German HTML template
        htmlToSend = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .ticket-info { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .ticket-id { font-size: 24px; font-weight: bold; color: #10b981; }
    .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ticket erfasst</h1>
    </div>
    <div class="content">
      <p>Guten Tag,</p>
      
      <p>Ihr Ticket wurde erfolgreich erstellt und im System protokolliert.</p>
      
      <div class="ticket-info">
        <p><strong>Ticket-Nummer:</strong></p>
        <p class="ticket-id">#${ticket.Number || ticket.id}</p>
        <p><strong>Betreff:</strong> ${ticket.title || "Kein Betreff"}</p>
        <p><strong>Erstellt am:</strong> ${new Date(ticket.createdAt).toLocaleString("de-DE")}</p>
      </div>
      
      <p>Sie können den Status Ihres Tickets jederzeit über den folgenden Link einsehen:</p>
      
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">Ticket ansehen</a>
      </p>
      
      <p>Bei Rückfragen zu diesem Ticket antworten Sie bitte einfach auf diese E-Mail.</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
    </div>
    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Ticket-Referenz: #${ticket.Number || ticket.id}</p>
    </div>
  </div>
</body>
</html>
        `;
      }

      const textContent = `Ticket erfasst\n\nGuten Tag,\n\nIhr Ticket #${ticket.Number || ticket.id} wurde erfolgreich erstellt.\n\nBetreff: ${ticket.title || "Kein Betreff"}\nErstellt am: ${new Date(ticket.createdAt).toLocaleString("de-DE")}\n\nTicket ansehen: ${ticketUrl}\n\nMit freundlichen Grüßen,\nIhr Support-Team\n\nRef: #${ticket.id}`;

      // Build mail options with optional BCC
      const mailOptions: any = {
        from: email.user,
        replyTo: imapQueue?.username || email.reply,
        to: ticket.email,
        subject: `[Ticket #${ticket.Number || ticket.id}] Anfrage wurde erfasst - ${ticket.title || "Neue Anfrage"}`,
        text: textContent,
        html: htmlToSend,
        messageId: messageId,
        headers: {
          "X-Ticket-ID": ticket.id,
        },
      };

      // Add BCC if support mailbox is configured
      if (email.supportMailbox) {
        mailOptions.bcc = email.supportMailbox;
      }

      await transport
        .sendMail(mailOptions)
        .then((info: any) => {
          console.log("Ticket created notification sent: %s", info.messageId);
        })
        .catch((err: any) => console.log(err));

      // Store the Message-ID in the ticket for reply matching
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { messageId: messageId },
      });
    }
  } catch (error) {
    console.log(error);
  }
}
