import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import multer from "fastify-multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { checkSession } from "../lib/session";

const upload = multer({ dest: "uploads/" });

// Ensure uploads directory exists on module load
fs.mkdirSync("uploads", { recursive: true });

export function objectStoreRoutes(fastify: FastifyInstance) {
  // ─────────────────────────────────────────────
  // Upload a single file to a ticket
  // ─────────────────────────────────────────────
  fastify.post(
    "/api/v1/storage/ticket/:id/upload/single",
    { preHandler: upload.single("file") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { id } = request.params as { id: string };
      const file = (request as any).file;
      if (!file) {
        return reply.status(400).send({ success: false, message: "No file provided" });
      }

      // Verify the ticket exists
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) {
        return reply.status(404).send({ success: false, message: "Ticket not found" });
      }

      const uploadedFile = await prisma.ticketFile.create({
        data: {
          ticketId: id,
          filename: file.originalname,
          path: file.path,
          mime: file.mimetype,
          size: file.size,
          encoding: file.encoding || "7bit",
          userId: user.id,
        },
      });

      reply.send({ success: true, file: uploadedFile });
    }
  );

  // ─────────────────────────────────────────────
  // List all files for a ticket
  // ─────────────────────────────────────────────
  fastify.get(
    "/api/v1/ticket/:id/file/get",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      const files = await prisma.ticketFile.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: "desc" },
      });

      reply.send({ success: true, files });
    }
  );

  // ─────────────────────────────────────────────
  // Download a ticket file
  // ─────────────────────────────────────────────
  fastify.get(
    "/api/v1/ticket/:id/file/:fileId/download",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { id, fileId } = request.params as { id: string; fileId: string };

      const file = await prisma.ticketFile.findFirst({
        where: { id: fileId, ticketId: id },
      });

      if (!file) {
        return reply.status(404).send({ success: false, message: "File not found" });
      }

      const filePath = path.resolve(file.path);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ success: false, message: "File missing from disk" });
      }

      const stream = fs.createReadStream(filePath);
      reply
        .header("Content-Type", file.mime || "application/octet-stream")
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`)
        .send(stream);
    }
  );

  // ─────────────────────────────────────────────
  // Delete a ticket file
  // ─────────────────────────────────────────────
  fastify.delete(
    "/api/v1/ticket/:id/file/:fileId/delete",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { id, fileId } = request.params as { id: string; fileId: string };

      const file = await prisma.ticketFile.findFirst({
        where: { id: fileId, ticketId: id },
      });

      if (!file) {
        return reply.status(404).send({ success: false, message: "File not found" });
      }

      // Delete from disk (best-effort)
      try {
        const filePath = path.resolve(file.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fsErr) {
        console.error(`Failed to delete file from disk: ${file.path}`, fsErr);
      }

      // Delete DB record
      await prisma.ticketFile.delete({ where: { id: fileId } });

      reply.send({ success: true });
    }
  );

  // ─────────────────────────────────────────────
  // User files — list all
  // ─────────────────────────────────────────────
  fastify.get(
    "/api/v1/users/file/all",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const files = await prisma.userFile.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      reply.send({ success: true, files });
    }
  );

  // ─────────────────────────────────────────────
  // User files — download
  // ─────────────────────────────────────────────
  fastify.get(
    "/api/v1/users/file/:fileId/download",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { fileId } = request.params as { fileId: string };

      const file = await prisma.userFile.findFirst({
        where: { id: fileId, userId: user.id },
      });

      if (!file) {
        return reply.status(404).send({ success: false, message: "File not found" });
      }

      const filePath = path.resolve(file.path);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ success: false, message: "File missing from disk" });
      }

      const stream = fs.createReadStream(filePath);
      reply
        .header("Content-Type", "application/octet-stream")
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`)
        .send(stream);
    }
  );

  // ─────────────────────────────────────────────
  // User files — delete
  // ─────────────────────────────────────────────
  fastify.delete(
    "/api/v1/users/file/:fileId/delete",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await checkSession(request);
      if (!user) {
        return reply.status(401).send({ success: false, message: "Unauthorized" });
      }

      const { fileId } = request.params as { fileId: string };

      const file = await prisma.userFile.findFirst({
        where: { id: fileId, userId: user.id },
      });

      if (!file) {
        return reply.status(404).send({ success: false, message: "File not found" });
      }

      // Delete from disk (best-effort)
      try {
        const filePath = path.resolve(file.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fsErr) {
        console.error(`Failed to delete user file from disk: ${file.path}`, fsErr);
      }

      await prisma.userFile.delete({ where: { id: fileId } });

      reply.send({ success: true });
    }
  );
}
