// Auth-Decorator: app.authenticate für JWT-geschützte Routes
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

export default fp(async (app) => {
  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: "unauthorized" });
      }
    },
  );
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
