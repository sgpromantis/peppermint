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
      // Default HTML template with ticket link
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
      <h2 style="margin: 0;">New Comment on Ticket #${id}</h2>
    </div>
    <div class="content">
      <p><strong>Ticket:</strong> ${title}</p>
      
      <div class="comment-box">
        <p style="margin: 0; white-space: pre-wrap;">${comment}</p>
      </div>
      
      <p>You can view the full ticket and respond online:</p>
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">View Ticket Online</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">Or simply reply to this email to add your response to the ticket.</p>
    </div>
    <div class="footer">
      <p>Ticket Reference: #${id}</p>
      <p>Reply to this email to respond, or <a href="${ticketUrl}">view online</a></p>
    </div>
  </div>
</body>
</html>
      `;
    }

    // Set up email threading headers
    const domain = provider.reply?.split("@")[1] || "peppermint.local";
    const messageId = `<comment-${id}-${randomUUID()}@${domain}>`;
    const references = ticket?.messageId ? [ticket.messageId] : [];
    const inReplyTo = ticket?.messageId || undefined;

    const textContent = `New comment on Ticket #${id}\n\nTicket: ${title}\n\nComment:\n${comment}\n\nView ticket online: ${ticketUrl}\n\nYou can reply to this email to respond to the ticket.\n\nRef: #${id}`;

    console.log("Sending comment notification to: ", email);
    await transport
      .sendMail({
        from: provider.reply,
        to: email,
        subject: `[Ticket #${id}] New comment - ${title}`,
        text: textContent,
        html: htmlToSend,
        messageId: messageId,
        references: references,
        inReplyTo: inReplyTo,
        headers: {
          "X-Ticket-ID": id,
        },
      })
      .then((info: any) => {
        console.log("Comment notification sent: %s", info.messageId);
      })
      .catch((err: any) => console.log(err));
  } catch (error) {
    console.log(error);
  }
}
