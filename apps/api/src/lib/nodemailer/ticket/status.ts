import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { randomUUID } from "crypto";
import { metrics } from "../../prometheus-metrics";
import { InstanceConfigService } from "../../services/instance-config.service";

export async function sendTicketStatus(ticket: any) {
  const email = await prisma.email.findFirst();

  if (!email) {
    console.log("No email provider configured - skipping status notification");
    return;
  }

  const transport = await createTransportProvider();

  // Look up the IMAP queue address for Reply-To so replies go to the monitored mailbox
  const imapQueue = await prisma.emailQueue.findFirst({ where: { active: true } });

  // Build ticket URL from instance config (database-first) or environment variables
  const baseUrl = await InstanceConfigService.getTicketPortalUrl();
  const ticketUrl = `${baseUrl}/issue/${ticket.id}`;
  const statusText = ticket.isComplete ? "ABGESCHLOSSEN" : "OFFEN";
  const statusTextGerman = ticket.isComplete ? "Abgeschlossen" : "Offen";
  const statusColor = ticket.isComplete ? "#10b981" : "#f59e0b";

  const testhtml = await prisma.emailTemplate.findFirst({
    where: {
      type: "ticket_status_changed",
    },
  });

  let htmlToSend: string;

  if (testhtml?.html) {
    var template = handlebars.compile(testhtml.html);
    var replacements = {
      title: ticket.title,
      status: statusText,
      id: ticket.id,
      ticketUrl: ticketUrl,
    };
    htmlToSend = template(replacements);
  } else {
    // Default German HTML template with ticket link
    htmlToSend = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${statusColor}; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .status-badge { display: inline-block; background-color: ${statusColor}; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
    .ticket-info { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Ticket-Status aktualisiert</h2>
    </div>
    <div class="content">
      <div class="ticket-info">
        <p><strong>Ticket #${ticket.id}</strong></p>
        <p><strong>Betreff:</strong> ${ticket.title}</p>
        <p><strong>Neuer Status:</strong> <span class="status-badge">${statusTextGerman}</span></p>
      </div>
      
      <p>Der Status Ihres Tickets wurde aktualisiert. Sie können die vollständigen Details online einsehen:</p>
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">Ticket online ansehen</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
    </div>
    <div class="footer">
      <p>Ticket-Referenz: #${ticket.id}</p>
      <p><a href="${ticketUrl}">Ticket online ansehen</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // Set up email threading headers
  const domain = email.reply?.split("@")[1] || "helpdesk.local";
  const messageId = `<status-${ticket.id}-${randomUUID()}@${domain}>`;
  const references = ticket.messageId ? [ticket.messageId] : [];
  const inReplyTo = ticket.messageId || undefined;

  const textContent = `Ticket-Status aktualisiert\n\nTicket #${ticket.id}\nBetreff: ${ticket.title}\nNeuer Status: ${statusTextGerman}\n\nTicket online ansehen: ${ticketUrl}\n\nAntworten Sie auf diese E-Mail bei Rückfragen.\n\nRef: #${ticket.id}`;

  // Build mail options with optional BCC
  const mailOptions: any = {
    from: email.reply,
    replyTo: imapQueue?.username || email.reply,
    to: ticket.replyTo || ticket.email,
    subject: `[Ticket #${ticket.id}] Status geändert: ${statusTextGerman} - ${ticket.title}`,
    text: textContent,
    html: htmlToSend,
    messageId: messageId,
    references: references,
    inReplyTo: inReplyTo,
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
      console.log("Status notification sent: %s", info.messageId);
    })
    .catch((err: any) => console.log(err));
}
