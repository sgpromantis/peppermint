import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import multer from "fastify-multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { checkSession } from "../lib/session";

// Absolute path so uploads are always in the same directory regardless of CWD
const UPLOADS_DIR = path.resolve(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination(_req: any, _file: any, cb: any) {
    cb(null, UPLOADS_DIR);
  },
  filename(_req: any, file: any, cb: any) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Ensure uploads directory exists on module load
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

      // Resolve path: absolute paths stay as-is; old relative paths
      // (e.g. "uploads/abc") resolve against UPLOADS_DIR parent
      let filePath = path.isAbsolute(file.path)
        ? file.path
        : path.resolve(UPLOADS_DIR, "..", file.path);
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ success: false, message: "File missing from disk" });
      }

      const stream = fs.createReadStream(filePath);
      const isImage = (file.mime || "").startsWith("image/");
      const disposition = isImage
        ? `inline; filename="${encodeURIComponent(file.filename)}"`
        : `attachment; filename="${encodeURIComponent(file.filename)}"`;
      reply
        .header("Content-Type", file.mime || "application/octet-stream")
        .header("Content-Disposition", disposition)
        .header("Cache-Control", "private, max-age=86400")
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
        const delPath = path.isAbsolute(file.path)
          ? file.path
          : path.resolve(UPLOADS_DIR, "..", file.path);
        if (fs.existsSync(delPath)) {
          fs.unlinkSync(delPath);
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

      let userFilePath = path.isAbsolute(file.path)
        ? file.path
        : path.resolve(UPLOADS_DIR, "..", file.path);
      if (!fs.existsSync(userFilePath)) {
        return reply.status(404).send({ success: false, message: "File missing from disk" });
      }

      const stream = fs.createReadStream(userFilePath);
      const mime = (file as any).mime || "application/octet-stream";
      const isImage = mime.startsWith("image/");
      const disposition = isImage
        ? `inline; filename="${encodeURIComponent(file.filename)}"`
        : `attachment; filename="${encodeURIComponent(file.filename)}"`;
      reply
        .header("Content-Type", mime)
        .header("Content-Disposition", disposition)
        .header("Cache-Control", "private, max-age=86400")
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
        const userDelPath = path.isAbsolute(file.path)
          ? file.path
          : path.resolve(UPLOADS_DIR, "..", file.path);
        if (fs.existsSync(userDelPath)) {
          fs.unlinkSync(userDelPath);
        }
      } catch (fsErr) {
        console.error(`Failed to delete user file from disk: ${file.path}`, fsErr);
      }

      await prisma.userFile.delete({ where: { id: fileId } });

      reply.send({ success: true });
    }
  );
}
