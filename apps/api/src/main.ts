import "dotenv/config";
import cors from "@fastify/cors";

// Construct DATABASE_URL from individual env vars if DB_HOST is set (Docker environment)
// DB_HOST takes priority over any existing DATABASE_URL to ensure Docker networking works
if (process.env.DB_HOST) {
  const dbUser = process.env.DB_USERNAME || 'peppermint';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_DATABASE || 'peppermint';
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;
  console.log(`DATABASE_URL constructed from DB_HOST: postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}`);
} else {
  console.log(`Using DATABASE_URL from env: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'not set'}`);
}

import Fastify, { FastifyInstance } from "fastify";
import multer from "fastify-multer";
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
    if (request.url === "/api/v1/auth/login" && request.method === "POST") {
      return true;
    }
    if (
      request.url === "/api/v1/ticket/public/create" &&
      request.method === "POST"
    ) {
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
    // Pass current environment (including constructed DATABASE_URL) to child processes
    const execOptions = { env: { ...process.env } };
    
    // Run prisma generate and migrate commands before starting the server
    await new Promise<void>((resolve, reject) => {
      exec("npx prisma migrate deploy", execOptions, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        console.log(stdout);
        console.error(stderr);

        exec("npx prisma generate", execOptions, (err, stdout, stderr) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          console.log(stdout);
          console.error(stderr);
        });

        exec("npx prisma db seed", execOptions, (err, stdout, stderr) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          console.log(stdout);
          console.error(stderr);
          resolve();
        });
      });
    });

    // connect to database
    await prisma.$connect();
    server.log.info("Connected to Prisma");

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
