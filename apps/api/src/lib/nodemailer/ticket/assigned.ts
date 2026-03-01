import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";
import { InstanceConfigService } from "../../services/instance-config.service";
import { isSystemAddress } from "./loop-prevention";

export async function sendAssignedEmail(email: any, ticketId?: string, ticketTitle?: string) {
  try {
    // Loop prevention: never send assigned notification to a system-monitored address
    if (await isSystemAddress(email)) {
      console.log(`[sendAssignedEmail] Skipped — recipient ${email} is a system address`);
      return;
    }

    const provider = await prisma.email.findFirst();

    if (provider) {
      const mail = await createTransportProvider();

      // Look up the IMAP queue address for Reply-To so replies go to the monitored mailbox
      const imapQueue = await prisma.emailQueue.findFirst({ where: { active: true } });

      console.log("Sending email to: ", email);

      // Build ticket URL if ticketId is provided
      const baseUrl = await InstanceConfigService.getTicketPortalUrl();
      const ticketUrl = ticketId ? `${baseUrl}/issue/${ticketId}` : baseUrl;

      const testhtml = await prisma.emailTemplate.findFirst({
        where: {
          type: "ticket_assigned",
        },
      });

      let htmlToSend: string;

      if (testhtml?.html) {
        var template = handlebars.compile(testhtml.html);
        var replacements = {
          id: ticketId,
          title: ticketTitle,
          ticketId: ticketId,
          ticketTitle: ticketTitle,
          ticketUrl: ticketUrl,
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
    .header { background-color: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .ticket-info { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .button { display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ticket zugewiesen</h1>
    </div>
    <div class="content">
      <p>Guten Tag,</p>
      
      <p>Ein neues Ticket wurde Ihnen zugewiesen.</p>
      
      ${ticketId ? `
      <div class="ticket-info">
        <p><strong>Ticket-Nummer:</strong> #${ticketId}</p>
        ${ticketTitle ? `<p><strong>Betreff:</strong> ${ticketTitle}</p>` : ''}
      </div>
      ` : ''}
      
      <p style="text-align: center;">
        <a href="${ticketUrl}" class="button">Ticket ansehen</a>
      </p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr Helpdesk-System</p>
    </div>
    <div class="footer">
      <p>Diese E-Mail wurde automatisch generiert.</p>
    </div>
  </div>
</body>
</html>
        `;
      }

      const textContent = `Ticket zugewiesen\n\nGuten Tag,\n\nEin neues Ticket wurde Ihnen zugewiesen.${ticketId ? `\n\nTicket-Nummer: #${ticketId}` : ''}${ticketTitle ? `\nBetreff: ${ticketTitle}` : ''}\n\nTicket ansehen: ${ticketUrl}\n\nMit freundlichen Grüßen,\nIhr Helpdesk-System`;

      // Build mail options with optional BCC
      const mailOptions: any = {
        from: provider.user, 
        replyTo: imapQueue?.username || provider.reply,
        to: email, 
        subject: ticketId ? `[Ticket #${ticketId}] Ein neues Ticket wurde Ihnen zugewiesen` : `Ein neues Ticket wurde Ihnen zugewiesen`, 
        text: textContent, 
        html: htmlToSend,
      };

      // Add BCC if support mailbox is configured
      if (provider.supportMailbox) {
        mailOptions.bcc = provider.supportMailbox;
      }

      await mail
        .sendMail(mailOptions)
        .then((info: any) => {
          console.log("Assigned notification sent: %s", info.messageId);
        })
        .catch((err: any) => console.log(err));
    }
  } catch (error) {
    console.log(error);
  }
}
