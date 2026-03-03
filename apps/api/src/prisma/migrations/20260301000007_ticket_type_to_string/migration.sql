-- Convert Ticket.type from TicketType enum to plain text
ALTER TABLE "Ticket" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "Ticket" ALTER COLUMN "type" SET DEFAULT 'support';

-- Add ticket_types JSON column to Config for custom type management
ALTER TABLE "Config" ADD COLUMN "ticket_types" JSONB;

-- Drop the TicketType enum since it is no longer referenced
DROP TYPE IF EXISTS "TicketType";
