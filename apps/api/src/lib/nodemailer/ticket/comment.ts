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

    const testhtml = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_comment",
      },
    });

    var template = handlebars.compile(testhtml?.html);
    var replacements = {
      title: title,
      comment: comment,
      id: id,
    };
    var htmlToSend = template(replacements);

    // Set up email threading headers
    const domain = provider.reply?.split("@")[1] || "peppermint.local";
    const messageId = `<comment-${id}-${randomUUID()}@${domain}>`;
    const references = ticket?.messageId ? [ticket.messageId] : [];
    const inReplyTo = ticket?.messageId || undefined;

    console.log("Sending comment notification to: ", email);
    await transport
      .sendMail({
        from: provider.reply,
        to: email,
        subject: `[Ticket #${id}] New comment - ${title}`,
        text: `Hello,\n\nA new comment has been added to your ticket #${id}:\n\n${comment}\n\nRef: #${id}`,
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
