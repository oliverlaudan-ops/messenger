// Fastify-Plugins: rate-limit (Auth-Bruteforce-Schutz)
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

export default fp(async (app) => {
  await app.register(rateLimit, {
    max: 60, // global: 60 req/min pro IP
    timeWindow: "1 minute",
    allowList: ["127.0.0.1"], // Healthchecks etc. unbegrenzt
  });
});
