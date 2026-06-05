// Fastify + Socket.IO bootstrap
// Wires up: CORS, JWT auth, Prisma, REST health route, Socket.IO server
// Real-time channels (group messages, DMs) come in step 4.

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./db.js";

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

io.on("connection", (socket) => {
  fastify.log.info(
    { userId: socket.data.userId, username: socket.data.username },
    "socket connected",
  );
  // Step 4: join group rooms, message:send, message:new events.
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
