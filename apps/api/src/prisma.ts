// Construct DATABASE_URL from individual env vars if DB_HOST is set (Docker environment)
// This must happen before PrismaClient is instantiated
if (process.env.DB_HOST) {
  const dbUser = process.env.DB_USERNAME || 'promantis';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_DATABASE || 'promantis';
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;
}

import { Hook, PrismaClient, Role, User } from "@prisma/client";
export const prisma: PrismaClient = new PrismaClient();
export { Hook, Role, User };
