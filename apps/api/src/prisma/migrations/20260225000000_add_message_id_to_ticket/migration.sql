-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "messageId" TEXT;

-- CreateIndex (optional: for faster lookups when matching email replies)
CREATE INDEX "Ticket_messageId_idx" ON "Ticket"("messageId");
