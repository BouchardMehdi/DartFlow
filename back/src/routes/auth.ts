import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../database.js";
import { normalizeEmail } from "../domain.js";

const credentialsSchema = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: config.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 };

async function setSession(reply: FastifyReply, user: { id: string; email: string }) {
  const token = await reply.jwtSign({ email: user.email }, { sign: { sub: user.id, expiresIn: "30d" } });
  reply.setCookie("dartflow_session", token, cookieOptions);
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Adresse email ou mot de passe invalide." });
    const email = normalizeEmail(parsed.data.email);
    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rowCount) return reply.code(409).send({ message: "Un compte utilise déjà cette adresse email." });
    const user = { id: randomUUID(), email };
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO users(id, email, password_hash) VALUES($1, $2, $3)", [user.id, user.email, passwordHash]);
      await client.query("INSERT INTO profile_access(profile_id, user_id, role) SELECT profile_id, $1, role FROM share_invitations WHERE email = $2 ON CONFLICT DO NOTHING", [user.id, user.email]);
      await client.query("DELETE FROM share_invitations WHERE email = $1", [user.email]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await setSession(reply, user);
    return reply.code(201).send({ user: { ...user, createdAt: new Date().toISOString() } });
  });

  app.post("/login", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Adresse email ou mot de passe invalide." });
    const result = await pool.query<{ id: string; email: string; password_hash: string; created_at: Date }>("SELECT id, email, password_hash, created_at FROM users WHERE email = $1", [normalizeEmail(parsed.data.email)]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(parsed.data.password, user.password_hash)) return reply.code(401).send({ message: "Adresse email ou mot de passe incorrect." });
    await setSession(reply, user);
    return { user: { id: user.id, email: user.email, createdAt: user.created_at.toISOString() } };
  });

  app.post("/logout", async (_request, reply) => { reply.clearCookie("dartflow_session", { path: "/" }); return reply.code(204).send(); });
  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const result = await pool.query<{ id: string; email: string; created_at: Date }>("SELECT id, email, created_at FROM users WHERE id = $1", [request.user.sub]);
    const user = result.rows[0];
    return user ? { user: { id: user.id, email: user.email, createdAt: user.created_at.toISOString() } } : reply.code(401).send({ message: "Session invalide." });
  });
};

export default authRoutes;
