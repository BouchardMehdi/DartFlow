import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import profileRoutes from "./routes/profiles.js";
import syncRoutes from "./routes/sync.js";
import friendRoutes from "./routes/friends.js";

export async function buildApp() {
  const app = Fastify({ logger: config.NODE_ENV !== "test", trustProxy: true, bodyLimit: 15_000_000 });
  await app.register(cors, { origin: config.FRONTEND_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(syncRoutes, { prefix: "/sync" });
  await app.register(profileRoutes, { prefix: "/profiles" });
  await app.register(friendRoutes, { prefix: "/friends" });
  await app.register(leaderboardRoutes, { prefix: "/leaderboard" });
  app.get("/health", async () => ({ status: "ok" }));
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const details = error && typeof error === "object" ? error as { code?: string; statusCode?: number; message?: string } : {};
    if (details.code === "23505") return reply.code(409).send({ message: "Cette donnée existe déjà." });
    const statusCode = details.statusCode && details.statusCode >= 400 && details.statusCode < 500 ? details.statusCode : 500;
    return reply.code(statusCode).send({ message: statusCode < 500 ? details.message ?? "Requête invalide." : "Une erreur interne est survenue." });
  });
  return app;
}
