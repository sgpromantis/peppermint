-- AlterTable: Make TicketFile.userId optional to support IMAP attachments from unknown senders
ALTER TABLE "TicketFile" ALTER COLUMN "userId" DROP NOT NULL;
