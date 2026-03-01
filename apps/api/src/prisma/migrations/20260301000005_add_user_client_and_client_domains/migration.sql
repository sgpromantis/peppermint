-- AlterTable: Add clientId to User for customer linking
ALTER TABLE "User" ADD COLUMN "clientId" TEXT;

-- AlterTable: Add domains array to Client for multi-domain matching
ALTER TABLE "Client" ADD COLUMN "domains" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey: User -> Client
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
