-- Add optional due date to tickets
ALTER TABLE "Ticket" ADD COLUMN "dueDate" TIMESTAMP(3);
