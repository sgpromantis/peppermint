import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { metrics } from "../../prometheus-metrics";
import { randomUUID } from "crypto";

export async function sendTicketConfirmation(ticket: any) {
  const startTime = Date.now();
  
  try {
    const email = await prisma.email.findFirst({});

    if (!email) {
      console.log("No email provider configured - skipping confirmation");
      return;
    }

    const transport = await createTransportProvider();

    // Generate a unique Message-ID for threading
    const domain = email.reply?.split("@")[1] || "helpdesk.local";
    const messageId = `<ticket-${ticket.id}-${randomUUID()}@${domain}>`;

    // Get custom template or use default
    const customTemplate = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_created",
      },
    });

    // Get base URL from environment or default
    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const ticketUrl = `${baseUrl}/portal/ticket/${ticket.id}`;

    let htmlToSend: string;

    if (customTemplate?.html) {
      const template = handlebars.compile(customTemplate.html);
      htmlToSend = template({
        id: ticket.id,
        title: ticket.title,
        ticketUrl: ticketUrl,
        name: ticket.name || "Kunde",
        createdAt: new Date(ticket.createdAt).toLocaleString("de-DE"),
      });
    } else {
      // Default confirmation email template
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
    .button:hover { background-color: #059669; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ticket erstellt</h1>
    </div>
    <div class="content">
      <p>Hallo ${ticket.name || "Kunde"},</p>
      
      <p>Vielen Dank für Ihre Anfrage. Wir haben Ihr Ticket erfolgreich angelegt und werden uns schnellstmöglich darum kümmern.</p>
      
      <div class="ticket-info">
        <p><strong>Ticket-Nummer:</strong></p>
        <p class="ticket-id">#${ticket.id}</p>
        <p><strong>Betreff:</strong> ${ticket.title}</p>
        <p><strong>Erstellt am:</strong> ${new Date(ticket.createdAt).toLocaleString("de-DE")}</p>
      </div>
      
      <p>Sie können den Status Ihres Tickets jederzeit über den folgenden Link einsehen:</p>
      
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">Ticket ansehen</a>
      </p>
      
      <p>Bei Rückfragen zu diesem Ticket antworten Sie bitte auf diese E-Mail mit der Referenznummer <strong>ref:${ticket.id}</strong> im Betreff.</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
    </div>
    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie mit ref:${ticket.id} im Betreff.</p>
    </div>
  </div>
</body>
</html>
      `;
    }

    // Build mail options with optional BCC
    const mailOptions: any = {
      from: email.reply,
      to: ticket.email,
      subject: `[Ticket #${ticket.id}] Ihre Anfrage wurde erfasst - ${ticket.title}`,
      text: `Hallo ${ticket.name || "Kunde"},\n\nVielen Dank für Ihre Anfrage. Ihr Ticket #${ticket.id} wurde erfolgreich angelegt.\n\nBetreff: ${ticket.title}\n\nSie können den Status hier einsehen: ${ticketUrl}\n\nBei Rückfragen antworten Sie bitte auf diese E-Mail mit ref:${ticket.id} im Betreff.\n\nMit freundlichen Grüßen,\nIhr Support-Team`,
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

    const info = await transport.sendMail(mailOptions);

    // Store the Message-ID in the ticket for reply matching
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { messageId: messageId },
    });

    // Track metrics
    const latency = Date.now() - startTime;
    metrics.incrementEmailsSent("ticket_created");
    metrics.recordSmtpLatency(latency);

    console.log("Ticket confirmation sent: %s with Message-ID: %s", info.messageId, messageId);
    return info;
  } catch (error: any) {
    metrics.incrementEmailsFailed(error.message);
    console.error("Failed to send ticket confirmation:", error);
    throw error;
  }
}
