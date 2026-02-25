import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { randomUUID } from "crypto";

export async function sendComment(
  comment: string,
  title: string,
  id: string,
  email: string
) {
  try {
    const provider = await prisma.email.findFirst();

    if (!provider) {
      console.log("No email provider configured - skipping comment notification");
      return;
    }

    const transport = await createTransportProvider();

    // Get the ticket to retrieve its messageId for threading
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    // Build ticket URL
    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const ticketUrl = `${baseUrl}/portal/ticket/${id}`;

    const testhtml = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_comment",
      },
    });

    let htmlToSend: string;

    if (testhtml?.html) {
      var template = handlebars.compile(testhtml.html);
      var replacements = {
        title: title,
        comment: comment,
        id: id,
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
    .header { background-color: #3b82f6; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .comment-box { background-color: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; border-radius: 4px; }
    .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Neuer Kommentar zu Ticket #${id}</h2>
    </div>
    <div class="content">
      <p><strong>Ticket:</strong> ${title}</p>
      
      <div class="comment-box">
        <p style="margin: 0; white-space: pre-wrap;">${comment}</p>
      </div>
      
      <p>Sie können das vollständige Ticket online einsehen und antworten:</p>
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">Ticket online ansehen</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">Oder antworten Sie einfach auf diese E-Mail, um Ihre Antwort zum Ticket hinzuzufügen.</p>
    </div>
    <div class="footer">
      <p>Ticket-Referenz: #${id}</p>
      <p>Antworten Sie auf diese E-Mail oder <a href="${ticketUrl}">online ansehen</a></p>
    </div>
  </div>
</body>
</html>
      `;
    }

    // Set up email threading headers
    const domain = provider.reply?.split("@")[1] || "helpdesk.local";
    const messageId = `<comment-${id}-${randomUUID()}@${domain}>`;
    const references = ticket?.messageId ? [ticket.messageId] : [];
    const inReplyTo = ticket?.messageId || undefined;

    const textContent = `Neuer Kommentar zu Ticket #${id}\n\nTicket: ${title}\n\nKommentar:\n${comment}\n\nTicket online ansehen: ${ticketUrl}\n\nSie können auf diese E-Mail antworten, um zum Ticket zu antworten.\n\nRef: #${id}`;

    console.log("Sending comment notification to: ", email);
    
    // Build mail options with optional BCC
    const mailOptions: any = {
      from: provider.reply,
      to: email,
      subject: `[Ticket #${id}] Neuer Kommentar - ${title}`,
      text: textContent,
      html: htmlToSend,
      messageId: messageId,
      references: references,
      inReplyTo: inReplyTo,
      headers: {
        "X-Ticket-ID": id,
      },
    };

    // Add BCC if support mailbox is configured
    if (provider.supportMailbox) {
      mailOptions.bcc = provider.supportMailbox;
    }

    await transport
      .sendMail(mailOptions)
      .then((info: any) => {
        console.log("Comment notification sent: %s", info.messageId);
      })
      .catch((err: any) => console.log(err));
  } catch (error) {
    console.log(error);
  }
}
