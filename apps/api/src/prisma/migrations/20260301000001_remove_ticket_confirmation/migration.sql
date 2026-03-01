-- First, update any existing ticket_confirmation templates to ticket_created
UPDATE "emailTemplate" 
SET type = 'ticket_created' 
WHERE type = 'ticket_confirmation';

-- Create new enum without ticket_confirmation
CREATE TYPE "Template_new" AS ENUM ('ticket_created', 'ticket_status_changed', 'ticket_assigned', 'ticket_comment');

-- Alter the table column to use text first (to break the enum dependency)
ALTER TABLE "emailTemplate" ALTER COLUMN "type" TYPE text;

-- Drop the old enum (now safe since no column uses it)
DROP TYPE "Template";

-- Rename the new enum to the original name
ALTER TYPE "Template_new" RENAME TO "Template";

-- Convert the column back to use the enum
ALTER TABLE "emailTemplate" ALTER COLUMN "type" TYPE "Template" USING (type::"Template");
