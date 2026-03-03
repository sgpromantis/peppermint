import "dotenv/config";
import cors from "@fastify/cors";
import multer from "fastify-multer";

import Fastify, { FastifyInstance } from "fastify";
import fs from "fs";

import { exec } from "child_process";
import { track } from "./lib/hog";
import { getEmails } from "./lib/imap";
import { checkToken } from "./lib/jwt";
import { prisma } from "./prisma";
import { registerRoutes } from "./routes";

// Ensure the directory exists
const logFilePath = "./logs.log"; // Update this path to a writable location

// Create a writable stream
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

// Initialize Fastify with logger
const server: FastifyInstance = Fastify({
  logger: {
    stream: logStream, // Use the writable stream
  },
  disableRequestLogging: true,
  trustProxy: true,
});
server.register(cors, {
  origin: "*",

  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
});

server.register(multer.contentParser);

registerRoutes(server);

server.get(
  "/",
  {
    schema: {
      tags: ["health"], // This groups the endpoint under a category
      description: "Health check endpoint",
      response: {
        200: {
          type: "object",
          properties: {
            healthy: { type: "boolean" },
          },
        },
      },
    },
  },
  async function (request, response) {
    response.send({ healthy: true });
  }
);

// JWT authentication hook
server.addHook("preHandler", async function (request: any, reply: any) {
  try {
    // Use routeOptions.url (the registered route pattern without query string)
    // Fallback: strip query string from request.url for safety
    const routePath = request.routeOptions?.url || request.url.split("?")[0];

    // Public endpoints that don't require authentication
    if (routePath === "/api/v1/auth/login" && request.method === "POST") {
      return true;
    }
    if (routePath === "/api/v1/auth/check" && request.method === "GET") {
      return true;
    }
    if (routePath === "/api/v1/auth/microsoft/check" && request.method === "GET") {
      return true;
    }
    if (routePath === "/api/v1/auth/microsoft/callback" && request.method === "GET") {
      return true;
    }
    if (routePath === "/api/v1/auth/oidc/callback" && request.method === "GET") {
      return true;
    }
    if (routePath === "/api/v1/auth/oauth/callback" && request.method === "GET") {
      return true;
    }
    if (routePath === "/api/v1/ticket/public/create" && request.method === "POST") {
      return true;
    }
    // Prometheus metrics endpoint (auth via METRICS_TOKEN if set)
    if (routePath === "/metrics" && request.method === "GET") {
      return true;
    }
    // Health check
    if (routePath === "/" && request.method === "GET") {
      return true;
    }
    const bearer = request.headers.authorization!.split(" ")[1];
    checkToken(bearer);
  } catch (err) {
    reply.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }
});

const start = async () => {
  try {
    // Connect to database first to clean up any failed migrations
    console.log("Connecting to database for cleanup...");
    
    try {
      // Delete any failed migration records that no longer exist in the codebase
      // This handles the case where migration files were removed but database still has the record
      const result = await prisma.$executeRawUnsafe(`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20260301000001_remove_ticket_confirmation'
      `);
      if (result > 0) {
        console.log("✓ Cleaned up orphaned migration record");
      }
    } catch (cleanupError) {
      console.log("Note: Cleanup skipped (first startup or already clean)");
    }

    // Pass current environment (including constructed DATABASE_URL) to child processes
    const execOptions = { env: { ...process.env } };
    
    // Now run prisma migrations with clean slate
    await new Promise<void>((resolve, reject) => {
      exec("npx prisma migrate deploy", execOptions, (err, stdout, stderr) => {
        if (err) {
          console.error("Migration failed:", err);
          reject(err);
          return;
        }
        console.log(stdout);
        if (stderr && !stderr.includes("DeprecationWarning")) {
          console.error(stderr);
        }

        exec("npx prisma generate", execOptions, (err, stdout, stderr) => {
          if (err) {
            console.error(err);
            reject(err);
            return;
          }
          console.log(stdout);
          if (stderr && !stderr.includes("DeprecationWarning")) {
            console.error(stderr);
          }

          exec("npx prisma db seed", execOptions, (err, stdout, stderr) => {
            if (err) {
              console.error(err);
              reject(err);
              return;
            }
            console.log(stdout);
            if (stderr && !stderr.includes("DeprecationWarning")) {
              console.error(stderr);
            }
            resolve();
          });
        });
      });
    });

    // connect to database
    await prisma.$connect();
    server.log.info("Connected to Prisma");

    // Idempotent: set default language to German for DB column & existing users
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "User" ALTER COLUMN "language" SET DEFAULT 'de'`
      );
      const updated = await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "language" = 'de' WHERE "language" = 'en' OR "language" IS NULL`
      );
      if (updated > 0) {
        console.log(`✓ Updated ${updated} user(s) default language to German`);
      }
    } catch (langErr) {
      console.log("Note: Language default update skipped:", (langErr as any).message);
    }

    const port = 5003;

    server.listen(
      { port: Number(port), host: "0.0.0.0" },
      async (err, address) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        const client = track();

        client.capture({
          event: "server_started",
          distinctId: "uuid",
        });

        client.shutdownAsync();
        console.info(`Server listening on ${address}`);
      }
    );

    setInterval(() => getEmails(), 10000); // Call getEmails every minute
  } catch (err) {
    server.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
