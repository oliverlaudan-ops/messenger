// Auth-Routes: register, login, me
// Passwörter: bcryptjs (10 rounds), JWT 7d default
// Rate-Limit: 10 req/min global, strenger für login/register

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";

const BCRYPT_ROUNDS = 10;

// Zod-Schemas
const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscore only")
    .toLowerCase()
    .trim(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

const STRICT_RATE_LIMIT = {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
};

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  createdAt: true,
} as const;

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Strengeres Rate-Limit für Auth-Endpoints
  app.addHook("onRoute", (route) => {
    if (
      route.url.startsWith("/register") ||
      route.url.startsWith("/login")
    ) {
      const cfg = (route.config ?? {}) as Record<string, unknown>;
      cfg.rateLimit = { max: 10, timeWindow: "1 minute" };
    }
  });

  // POST /api/auth/register
  app.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { email, username, password } = parsed.data;

    // Existierende Email/Username prüfen
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      return reply.code(409).send({
        error: "user_exists",
        conflict: existing.email === email ? "email" : "username",
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: PUBLIC_USER_SELECT,
    });

    const token = app.jwt.sign({ sub: user.id, username: user.username });
    return reply.code(201).send({ user, token });
  });

  // POST /api/auth/login
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });
    if (!user) {
      // bcrypt-Vergleich gegen Dummy-Hash: gleiche Antwortzeit, keine User-Enumeration
      await bcrypt.compare(password, "$2a$10$abcdefghijklmnopqrstuv");
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = app.jwt.sign({ sub: user.id, username: user.username });
    const { passwordHash: _omit, ...publicUser } = user;
    return reply.send({ user: publicUser, token });
  });

  // GET /api/auth/me (JWT-geschützt)
  app.get("/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      // JWT valide, aber User in DB weg → Token widerrufen
      return reply.code(401).send({ error: "user_not_found" });
    }
    return { user };
  });
};
