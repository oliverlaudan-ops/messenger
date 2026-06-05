// Fastify + Socket.IO bootstrap
// Wires up: CORS, JWT auth, Prisma, REST health route, Socket.IO server
// Real-time channels (group messages) come in step 4.

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./db.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import authenticatePlugin from "./plugins/authenticate.js";
import { authRoutes } from "./routes/auth.js";
import { groupRoutes } from "./routes/groups.js";
import { messageRoutes } from "./routes/messages.js";
import { pushRoutes } from "./routes/push.js";
import { initPush } from "./push.js";
import { setIO } from "./realtime/socket.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

// CORS — allow frontend origin in dev (GitHub Pages historically, now self-hosted)
// In production both are on messenger.future-pulse.de so CORS is same-origin.
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow no-origin (curl, server-to-server) and any *.future-pulse.de
    if (!origin) return cb(null, true);
    if (/^https:\/\/([a-z0-9-]+\.)?future-pulse\.de$/i.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
});

// JWT — payload shape: { sub: userId, username }
await fastify.register(jwt, {
  secret: JWT_SECRET,
});

// Plugins
await fastify.register(rateLimitPlugin);
await fastify.register(authenticatePlugin);

// Health route
fastify.get("/api/health", async () => {
  // DB ping
  const dbOk = await prisma
    .$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);
  return {
    status: "ok",
    db: dbOk ? "up" : "down",
    time: new Date().toISOString(),
  };
});

// HTTP server (for Socket.IO upgrade)
const server = fastify.server;

// Auth routes
await fastify.register(authRoutes, { prefix: "/api/auth" });
// Group + Message routes
await fastify.register(groupRoutes, { prefix: "/api/groups" });
await fastify.register(messageRoutes, { prefix: "/api/groups" });
await fastify.register(pushRoutes, { prefix: "/api/push" });

// Web-Push initialisieren (VAPID-Keys)
initPush();
// Socket.IO — JWT verified in `io.use` middleware
const io = new SocketIOServer(server, {
  cors: {
    origin: /future-pulse\.de$/,
    credentials: true,
  },
  path: "/socket.io",
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("no token"));
  try {
    const payload = fastify.jwt.verify<{ sub: string; username: string }>(token);
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  } catch (err) {
    next(new Error("invalid token"));
  }
});

setIO(io);

io.on("connection", (socket) => {
  fastify.log.info(
    { userId: socket.data.userId, username: socket.data.username },
    "socket connected",
  );

  // Client tritt einer Group-Room bei. Server prüft Membership in DB,
  // dann `socket.join("group:<id>")`. Antwortet mit ack.
  socket.on(
    "group:join",
    async (
      payload: { groupId?: string },
      ack?: (resp: { ok: boolean; error?: string }) => void,
    ) => {
      const groupId = payload?.groupId;
      if (!groupId) return ack?.({ ok: false, error: "groupId required" });
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: socket.data.userId } },
      });
      if (!member) return ack?.({ ok: false, error: "not_a_member" });
      await socket.join(`group:${groupId}`);
      fastify.log.info(
        { userId: socket.data.userId, groupId },
        "socket joined group",
      );
      ack?.({ ok: true });
    },
  );

  // Verlassen (z.B. wenn Frontend Group-View schließt)
  socket.on("group:leave", async (payload: { groupId?: string }) => {
    if (!payload?.groupId) return;
    await socket.leave(`group:${payload.groupId}`);
  });

  socket.on("disconnect", (reason) => {
    fastify.log.info({ userId: socket.data.userId, reason }, "socket disconnected");
  });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info({ signal }, "shutting down");
  io.close();
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`messenger-backend ready on http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
