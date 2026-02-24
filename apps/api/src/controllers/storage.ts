import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

// Ensure uploads directory exists
const uploadsDir = "uploads/";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function objectStoreRoutes(fastify: FastifyInstance) {
  //
  fastify.post(
    "/api/v1/storage/ticket/:id/upload/single",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ error: "No file uploaded" });
        }

        // Generate unique filename
        const filename = `${Date.now()}-${data.filename}`;
        const filepath = path.join(uploadsDir, filename);

        // Save file to disk
        await pipeline(data.file, fs.createWriteStream(filepath));

        // Get user from fields
        const fields = data.fields;
        const userId = fields.user ? (typeof fields.user === "object" ? (fields.user as any).value : fields.user) : null;

        const uploadedFile = await prisma.ticketFile.create({
          data: {
            ticketId: request.params.id,
            filename: data.filename,
            path: filepath,
            mime: data.mimetype,
            size: fs.statSync(filepath).size,
            encoding: data.encoding,
            userId: userId,
          },
        });

        console.log(uploadedFile);

        reply.send({
          success: true,
        });
      } catch (error) {
        console.error("Upload error:", error);
        reply.code(500).send({ error: "Upload failed" });
      }
    }
  );

  // Get all ticket attachments

  // Delete an attachment

  // Download an attachment
}
