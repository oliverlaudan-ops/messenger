// Message-Routes (Gruppen-Messages).
// REST: history holen, send speichert + broadcast via Socket.IO.
// DMs (Direct Messages) kommen in einem späteren Schritt — eigenes Pattern
// (DmChat + DmParticipant) ist im Schema schon da, Routes analog.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { broadcastToGroup } from "../realtime/socket.js";

const sendMessageSchema = z.object({
  text: z.string().min(1).max(4000).trim(),
});

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
} as const;

const MESSAGE_SELECT = {
  id: true,
  groupId: true,
  authorId: true,
  text: true,
  createdAt: true,
  author: { select: PUBLIC_USER_SELECT },
} as const;

export const messageRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/groups/:groupId/messages?limit=50&before=<iso>
  app.get<{
    Params: { groupId: string };
    Querystring: { limit?: string; before?: string };
  }>("/:groupId/messages", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user;
    const { groupId } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const before = req.query.before ? new Date(req.query.before) : undefined;

    // Member-Check
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) return reply.code(403).send({ error: "not_a_member" });

    const messages = await prisma.message.findMany({
      where: { groupId, ...(before ? { createdAt: { lt: before } } : {}) },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { messages: messages.reverse() };
  });

  // POST /api/groups/:groupId/messages
  app.post<{ Params: { groupId: string } }>(
    "/:groupId/messages",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub: userId } = req.user;
      const { groupId } = req.params;

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "validation_failed",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Member-Check
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!member) return reply.code(403).send({ error: "not_a_member" });

      const message = await prisma.message.create({
        data: { groupId, authorId: userId, text: parsed.data.text },
        select: MESSAGE_SELECT,
      });

      // Realtime-Broadcast an alle Member (außer dem Sender, der hat's schon)
      broadcastToGroup(groupId, "message:new", message);

      return reply.code(201).send({ message });
    },
  );
};
