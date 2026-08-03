import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { normalizeEmail, normalizeUsername } from "../domain.js";
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } from "../recovery.js";
import { clearSessionCookies, createSession, revokeSession, rotateSession } from "../session.js";

const loginSchema = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
const registerSchema = loginSchema.extend({ username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/) });
const avatarSchema = z.object({ avatar: z.string().max(750_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable() });
const resetPasswordSchema = z.object({ username: z.string().trim().min(3).max(24), email: z.email().max(254), recoveryCode: z.string().min(20).max(64), newPassword: z.string().min(8).max(128) });

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Utilise un pseudo de 3 à 24 caractères avec lettres, chiffres ou _." });
    const email = normalizeEmail(parsed.data.email); const username = normalizeUsername(parsed.data.username);
    const exists = await pool.query("SELECT 1 FROM users WHERE email=$1 OR lower(username)=$2", [email, username]);
    if (exists.rowCount) return reply.code(409).send({ message: "Cette adresse email ou ce nom d’utilisateur est déjà utilisé." });
    const user = { id: randomUUID(), email, username, createdAt: new Date().toISOString(), sessionVersion: 1 };
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const recoveryCode = generateRecoveryCode();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO users(id,email,username,password_hash,recovery_code_hash,recovery_code_created_at,session_version,created_at) VALUES($1,$2,$3,$4,$5,now(),1,$6)", [user.id, user.email, user.username, passwordHash, hashRecoveryCode(recoveryCode), user.createdAt]);
      await client.query("INSERT INTO profile_access(profile_id,user_id,role) SELECT profile_id,$1,CASE WHEN role='editor' THEN 'manager' ELSE 'player' END FROM share_invitations WHERE email=$2 ON CONFLICT DO NOTHING", [user.id, user.email]);
      await client.query("DELETE FROM share_invitations WHERE email=$1", [user.email]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return reply.code(201).send({ ...(await createSession(reply, user, request.headers["user-agent"])), recoveryCode });
  });

  app.post("/login", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Adresse email ou mot de passe invalide." });
    const result = await pool.query<{ id: string; email: string; username: string; avatar: string | null; password_hash: string; created_at: Date; session_version: number }>("SELECT id,email,username,avatar,password_hash,created_at,session_version FROM users WHERE email=$1", [normalizeEmail(parsed.data.email)]);
    const found = result.rows[0];
    if (!found || !await bcrypt.compare(parsed.data.password, found.password_hash)) return reply.code(401).send({ message: "Adresse email ou mot de passe incorrect." });
    const user = { id: found.id, email: found.email, username: found.username, ...(found.avatar ? { avatar: found.avatar } : {}), createdAt: found.created_at.toISOString(), sessionVersion: found.session_version };
    return createSession(reply, user, request.headers["user-agent"]);
  });

  app.post("/reset-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Informations de récupération invalides." });
    const email = normalizeEmail(parsed.data.email); const username = normalizeUsername(parsed.data.username);
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; recovery_code_hash: string | null }>("SELECT id,recovery_code_hash FROM users WHERE email=$1 AND lower(username)=$2 FOR UPDATE", [email, username]);
      const user = result.rows[0];
      if (!user || !verifyRecoveryCode(parsed.data.recoveryCode, user.recovery_code_hash)) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ message: "Informations de récupération invalides." });
      }
      await client.query("UPDATE users SET password_hash=$1,recovery_code_hash=NULL,recovery_code_created_at=NULL,session_version=session_version+1,updated_at=now() WHERE id=$2", [passwordHash, user.id]);
      await client.query("UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1", [user.id]);
      await client.query("COMMIT");
      clearSessionCookies(reply);
      return { reset: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  });

  app.post("/refresh", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const session = await rotateSession(reply, request.cookies.dartflow_refresh, request.headers["user-agent"]);
    if (!session) return reply.code(401).send({ message: "Session expirée." });
    return session;
  });

  app.post("/logout", async (request, reply) => { await revokeSession(request.cookies.dartflow_refresh); clearSessionCookies(reply); return reply.code(204).send(); });
  app.post("/recovery-code", { preHandler: app.authenticate, config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const recoveryCode = generateRecoveryCode();
    const result = await pool.query("UPDATE users SET recovery_code_hash=$1,recovery_code_created_at=now(),updated_at=now() WHERE id=$2", [hashRecoveryCode(recoveryCode), request.user.sub]);
    return result.rowCount ? { recoveryCode } : reply.code(404).send({ message: "Compte introuvable." });
  });
  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const result = await pool.query<{ id: string; email: string; username: string; avatar: string | null; created_at: Date }>("SELECT id,email,username,avatar,created_at FROM users WHERE id=$1", [request.user.sub]);
    const user = result.rows[0];
    return user ? { user: { id: user.id, email: user.email, username: user.username, ...(user.avatar ? { avatar: user.avatar } : {}), createdAt: user.created_at.toISOString() }, accessExpiresAt: request.user.exp ? new Date(request.user.exp * 1000).toISOString() : new Date(Date.now() + 60 * 60 * 1000).toISOString() } : reply.code(401).send({ message: "Session invalide." });
  });
  app.patch("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Nom d’utilisateur invalide." });
    const username = normalizeUsername(parsed.data.username);
    const conflict = await pool.query("SELECT 1 FROM users WHERE lower(username)=$1 AND id<>$2", [username, request.user.sub]);
    if (conflict.rowCount) return reply.code(409).send({ message: "Ce nom d’utilisateur est déjà utilisé." });
    const result = await pool.query<{ id: string; email: string; username: string; avatar: string | null; created_at: Date }>("UPDATE users SET username=$1,updated_at=now() WHERE id=$2 RETURNING id,email,username,avatar,created_at", [username, request.user.sub]);
    const user = result.rows[0];
    return user ? { user: { id:user.id,email:user.email,username:user.username,...(user.avatar?{avatar:user.avatar}:{}),createdAt:user.created_at.toISOString() } } : reply.code(404).send({ message: "Compte introuvable." });
  });
  app.patch("/me/avatar", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = avatarSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Image invalide ou trop volumineuse." });
    const result = await pool.query<{ id: string; email: string; username: string; avatar: string | null; created_at: Date }>("UPDATE users SET avatar=$1,updated_at=now() WHERE id=$2 RETURNING id,email,username,avatar,created_at", [parsed.data.avatar, request.user.sub]);
    const user = result.rows[0];
    return user ? { user: { id:user.id,email:user.email,username:user.username,...(user.avatar?{avatar:user.avatar}:{}),createdAt:user.created_at.toISOString() } } : reply.code(404).send({ message: "Compte introuvable." });
  });
};

export default authRoutes;
