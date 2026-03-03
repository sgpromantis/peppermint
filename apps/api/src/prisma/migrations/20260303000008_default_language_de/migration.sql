-- Change default language from "en" to "de"
ALTER TABLE "User" ALTER COLUMN "language" SET DEFAULT 'de';

-- Update all existing users who still have English as language
UPDATE "User" SET "language" = 'de' WHERE "language" = 'en' OR "language" IS NULL;
