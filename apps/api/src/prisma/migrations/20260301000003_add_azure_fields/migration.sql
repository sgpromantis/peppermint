-- Add Microsoft Azure ID and Azure AD configuration fields
ALTER TABLE "User" ADD COLUMN "microsoftAzureId" TEXT UNIQUE;
ALTER TABLE "Config" ADD COLUMN "microsoft_ad_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Config" ADD COLUMN "microsoft_ad_redirect_uri" VARCHAR(255);
