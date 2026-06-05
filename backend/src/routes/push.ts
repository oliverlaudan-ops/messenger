// Push-Routes: VAPID-Public-Key, Subscribe, Unsubscribe
// Frontend fragt /vapid-key, subscribed dann via pushManager.subscribe()
// und schickt das Subscription-Objekt hierher.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { vapidPublicKey } from "../push.js";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(64),
  }),
  userAgent: z.string().max(512).optional(),
});

export const pushRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/push/vapid-key — public, für Frontend
  app.get("/vapid-key", async (_req, reply) => {
    const key = vapidPublicKey();
    if (!key) {
      return reply.code(503).send({ error: "push_not_configured" });
    }
    return { publicKey: key };
  });

  // POST /api/push/subscribe — JWT-geschützt
  app.post("/subscribe", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user;
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { endpoint, keys, userAgent } = parsed.data;

    // Upsert: ein endpoint gehört immer einem User (kann sich aber bei Browser-Wechsel ändern)
    await prisma.pushToken.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
        lastUsed: new Date(),
      },
    });
    return { ok: true };
  });

  // DELETE /api/push/subscribe — JWT-geschützt
  app.delete<{ Body: { endpoint?: string } }>(
    "/subscribe",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub: userId } = req.user;
      const endpoint = req.body?.endpoint;
      if (!endpoint) {
        return reply.code(400).send({ error: "endpoint required" });
      }
      await prisma.pushToken
        .delete({ where: { endpoint } })
        .catch(() => reply.code(404).send({ error: "not_found" }));
      return { ok: true };
    },
  );
};
