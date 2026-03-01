const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
  const setup = await prisma.config.findFirst({});
  const templates = await prisma.emailTemplate.findMany({});

  if (setup === null) {
    await prisma.user.upsert({
      where: { email: "admin@admin.com" },
      update: {},
      create: {
        email: `admin@admin.com`,
        name: "admin",
        isAdmin: true,
        password:
          "$2b$10$BFmibvOW7FtY0soAAwujoO9y2tIyB7WEJ2HNq9O7zh9aeejMvRsKu",
        language: "de",
      },
    });

    await prisma.client.upsert({
      where: { email: `internal@admin.com` },
      update: {},
      create: {
        email: `internal@admin.com`,
        name: "internal",
        contactName: "admin",
        number: "123456789",
        active: true,
      },
    });

    const encryptionKey = crypto.randomBytes(32); // Generates a random key

    const conf = await prisma.config.create({
      data: {
        gh_version: "0.4.3",
        client_version: "0.4.3",
        encryption_key: encryptionKey,
      },
    });

    await prisma.config.update({
      where: {
        id: conf.id,
      },
      data: {
        first_time_setup: false,
      },
    });
  } else {
    console.log("No need to seed, already seeded");
  }

  if (templates.length === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="de">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <div style="background-color:#10b981;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
                      <h1 style="margin:0;font-size:24px">Ticket zugewiesen</h1>
                    </div>
                    <div style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb">
                      <p>Hallo,</p>
                      <p>Ihnen wurde ein neues Ticket zugewiesen. Bitte prüfen Sie es und antworten Sie bei nächster Gelegenheit.</p>
                      <div style="background-color:white;padding:15px;border-radius:8px;margin:15px 0">
                        <p style="margin:0"><strong>Ticket-Nummer:</strong></p>
                        <p style="font-size:24px;font-weight:bold;color:#10b981;margin:5px 0">#{{id}}</p>
                        <p><strong>Titel:</strong> {{title}}</p>
                      </div>
                      <p style="text-align:center">
                        <a href="{{ticketUrl}}" style="display:inline-block;background-color:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:15px 0">Ticket ansehen</a>
                      </p>
                      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
                    </div>
                    <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px">
                      <p>Ticket-Referenz: #{{id}}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_assigned",
        },
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="de">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <div style="background-color:#3b82f6;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
                      <h1 style="margin:0;font-size:24px">Ticket-Aktualisierung</h1>
                    </div>
                    <div style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb">
                      <p>Hallo,</p>
                      <p>Es gibt eine neue Aktualisierung zu Ihrem Ticket:</p>
                      <div style="background-color:white;padding:15px;border-radius:8px;margin:15px 0">
                        <p style="margin:0"><strong>Ticket:</strong> {{title}}</p>
                        <p style="margin-top:10px"><strong>Kommentar:</strong></p>
                        <div style="background-color:#f9fafb;padding:10px;border-left:3px solid #3b82f6;margin:10px 0">
                          {{comment}}
                        </div>
                      </div>
                      <p style="text-align:center">
                        <a href="{{ticketUrl}}" style="display:inline-block;background-color:#3b82f6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:15px 0">Ticket ansehen</a>
                      </p>
                      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
                    </div>
                    <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px">
                      <p>Ticket-Referenz: #{{id}}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_comment",
        },
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="de">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <div style="background-color:#8b5cf6;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
                      <h1 style="margin:0;font-size:24px">Neues Ticket erstellt</h1>
                    </div>
                    <div style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb">
                      <p>Hallo,</p>
                      <p>Ihr Ticket wurde erfolgreich erstellt und protokolliert. Unser Team wird sich in Kürze darum kümmern.</p>
                      <div style="background-color:white;padding:15px;border-radius:8px;margin:15px 0">
                        <p style="margin:0"><strong>Ticket-Nummer:</strong></p>
                        <p style="font-size:24px;font-weight:bold;color:#8b5cf6;margin:5px 0">#{{id}}</p>
                        <p><strong>Titel:</strong> {{title}}</p>
                      </div>
                      <p style="text-align:center">
                        <a href="{{ticketUrl}}" style="display:inline-block;background-color:#8b5cf6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:15px 0">Ticket ansehen</a>
                      </p>
                      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
                    </div>
                    <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px">
                      <p>Ticket-Referenz: #{{id}}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_created",
        },
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="de">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <div style="background-color:#f59e0b;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
                      <h1 style="margin:0;font-size:24px">Ticket-Status geändert</h1>
                    </div>
                    <div style="background-color:#f9fafb;padding:20px;border:1px solid #e5e7eb">
                      <p>Hallo,</p>
                      <p>Der Status Ihres Tickets hat sich geändert.</p>
                      <div style="background-color:white;padding:15px;border-radius:8px;margin:15px 0">
                        <p style="margin:0"><strong>Ticket:</strong> {{title}}</p>
                        <p style="margin-top:10px"><strong>Neuer Status:</strong></p>
                        <p style="font-size:20px;font-weight:bold;color:#f59e0b;margin:5px 0">{{status}}</p>
                      </div>
                      <p style="text-align:center">
                        <a href="{{ticketUrl}}" style="display:inline-block;background-color:#f59e0b;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:15px 0">Ticket ansehen</a>
                      </p>
                      <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>
                    </div>
                    <div style="text-align:center;padding:20px;color:#6b7280;font-size:12px">
                      <p>Ticket-Referenz: #{{id}}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_status_changed",
        },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
