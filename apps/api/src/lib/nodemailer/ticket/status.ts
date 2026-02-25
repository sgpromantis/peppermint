import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { randomUUID } from "crypto";

export async function sendTicketStatus(ticket: any) {
  const email = await prisma.email.findFirst();

  if (!email) {
    console.log("No email provider configured - skipping status notification");
    return;
  }

  const transport = await createTransportProvider();

  // Build ticket URL
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const ticketUrl = `${baseUrl}/portal/ticket/${ticket.id}`;
  const statusText = ticket.isComplete ? "COMPLETED" : "OPEN";
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
    // Default HTML template with ticket link
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
      <h2 style="margin: 0;">Ticket Status Updated</h2>
    </div>
    <div class="content">
      <div class="ticket-info">
        <p><strong>Ticket #${ticket.id}</strong></p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>New Status:</strong> <span class="status-badge">${statusText}</span></p>
      </div>
      
      <p>Your ticket status has been updated. You can view the full details online:</p>
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">View Ticket Online</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">If you have any questions, simply reply to this email.</p>
    </div>
    <div class="footer">
      <p>Ticket Reference: #${ticket.id}</p>
      <p><a href="${ticketUrl}">View ticket online</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // Set up email threading headers
  const domain = email.reply?.split("@")[1] || "peppermint.local";
  const messageId = `<status-${ticket.id}-${randomUUID()}@${domain}>`;
  const references = ticket.messageId ? [ticket.messageId] : [];
  const inReplyTo = ticket.messageId || undefined;

  const textContent = `Ticket Status Updated\n\nTicket #${ticket.id}\nTitle: ${ticket.title}\nNew Status: ${statusText}\n\nView ticket online: ${ticketUrl}\n\nReply to this email if you have any questions.\n\nRef: #${ticket.id}`;

  await transport
    .sendMail({
      from: email.reply,
      to: ticket.email,
      subject: `[Ticket #${ticket.id}] Status changed to ${statusText} - ${ticket.title}`,
      text: textContent,
      html: htmlToSend,
      messageId: messageId,
      references: references,
      inReplyTo: inReplyTo,
      headers: {
        "X-Ticket-ID": ticket.id,
      },
    })
    .then((info: any) => {
      console.log("Status notification sent: %s", info.messageId);
    })
    .catch((err: any) => console.log(err));
}
