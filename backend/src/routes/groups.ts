// Group-Routes: create, list, detail, members
// Auth: alle Routen erfordern JWT
// Member-Awareness: list/detail nur Gruppen wo User Mitglied ist

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const createGroupSchema = z.object({
  name: z.string().min(1).max(64).trim(),
  description: z.string().max(500).trim().optional(),
  memberIds: z.array(z.string().cuid()).default([]),
});

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
} as const;

export const groupRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/groups — create group, creator becomes OWNER, memberIds werden MEMBER
  app.post("/", { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { name, description, memberIds } = parsed.data;
    const { sub: ownerId } = req.user;

    // Validierung: alle memberIds existieren
    let validUserIds: string[] = [];
    if (memberIds.length > 0) {
      const existing = await prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      });
      validUserIds = existing.map((u) => u.id);
      if (validUserIds.length !== memberIds.length) {
        return reply.code(400).send({ error: "invalid_member_ids" });
      }
    }

    // Owner nicht doppelt einfügen
    const allMembers = Array.from(new Set([ownerId, ...validUserIds]));

    const group = await prisma.group.create({
      data: {
        name,
        description: description ?? null,
        ownerId,
        members: {
          create: allMembers.map((uid) => ({
            userId: uid,
            role: uid === ownerId ? "OWNER" : "MEMBER",
          })),
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: { select: PUBLIC_USER_SELECT },
          },
        },
      },
    });
    return reply.code(201).send({ group });
  });

  // GET /api/groups — alle Gruppen des Users
  app.get("/", { onRequest: [app.authenticate] }, async (req) => {
    const { sub: userId } = req.user;
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: {
        role: true,
        joinedAt: true,
        lastReadAt: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            createdAt: true,
            members: { select: { userId: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
    return {
      groups: memberships.map((m) => ({
        ...m.group,
        memberCount: m.group.members.length,
        myRole: m.role,
        myLastReadAt: m.lastReadAt,
      })),
    };
  });

  // GET /api/groups/:id — Detail mit Member-Liste
  app.get<{ Params: { id: string } }>(
    "/:id",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub: userId } = req.user;
      const { id } = req.params;

      // Member-Check
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: id, userId } },
      });
      if (!membership) {
        return reply.code(403).send({ error: "not_a_member" });
      }

      const group = await prisma.group.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          ownerId: true,
          createdAt: true,
          members: {
            select: {
              userId: true,
              role: true,
              joinedAt: true,
              user: { select: PUBLIC_USER_SELECT },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      });
      if (!group) {
        return reply.code(404).send({ error: "not_found" });
      }
      return { group, myRole: membership.role };
    },
  );
};
