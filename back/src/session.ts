import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import { config } from "./config.js";
import { pool } from "./database.js";

export interface SessionUser { id: string; email: string; username: string; createdAt: string }
const accessCookie = "dartflow_access";
const refreshCookie = "dartflow_refresh";
const baseCookie = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: config.COOKIE_SECURE };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function newRefreshToken() {
  const id = randomUUID();
  return { id, token: `${id}.${randomBytes(48).toString("base64url")}` };
}

async function setCookies(reply: FastifyReply, user: SessionUser, refreshToken: string) {
  const accessMaxAge = config.ACCESS_TOKEN_TTL_HOURS * 60 * 60;
  const access = await reply.jwtSign({ email: user.email, username: user.username }, { sign: { sub: user.id, expiresIn: `${config.ACCESS_TOKEN_TTL_HOURS}h` } });
  reply.setCookie(accessCookie, access, { ...baseCookie, maxAge: accessMaxAge });
  reply.setCookie(refreshCookie, refreshToken, { ...baseCookie, maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 });
  return new Date(Date.now() + accessMaxAge * 1000).toISOString();
}

export async function createSession(reply: FastifyReply, user: SessionUser, userAgent?: string) {
  const refresh = newRefreshToken();
  await pool.query("INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at,user_agent) VALUES($1,$2,$3,now()+($4 || ' days')::interval,$5)", [refresh.id, user.id, hash(refresh.token), config.REFRESH_TOKEN_TTL_DAYS, userAgent ?? null]);
  const accessExpiresAt = await setCookies(reply, user, refresh.token);
  return { user, accessExpiresAt };
}

export async function rotateSession(reply: FastifyReply, refreshToken: string | undefined, userAgent?: string) {
  if (!refreshToken) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; user_id: string; revoked_at: Date | null; expires_at: Date; email: string; username: string; created_at: Date }>(`SELECT rs.id,rs.user_id,rs.revoked_at,rs.expires_at,u.email,u.username,u.created_at FROM refresh_sessions rs JOIN users u ON u.id=rs.user_id WHERE rs.token_hash=$1 FOR UPDATE`, [hash(refreshToken)]);
    const current = result.rows[0];
    if (!current || current.expires_at.getTime() <= Date.now()) { await client.query("ROLLBACK"); return null; }
    if (current.revoked_at) { await client.query("ROLLBACK"); return null; }
    const next = newRefreshToken();
    await client.query("UPDATE refresh_sessions SET revoked_at=now(),replaced_by=$2,last_used_at=now() WHERE id=$1", [current.id, next.id]);
    await client.query("INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at,user_agent) VALUES($1,$2,$3,now()+($4 || ' days')::interval,$5)", [next.id, current.user_id, hash(next.token), config.REFRESH_TOKEN_TTL_DAYS, userAgent ?? null]);
    await client.query("COMMIT");
    const user = { id: current.user_id, email: current.email, username: current.username, createdAt: current.created_at.toISOString() };
    const accessExpiresAt = await setCookies(reply, user, next.token);
    return { user, accessExpiresAt };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function revokeSession(refreshToken: string | undefined) {
  if (refreshToken) await pool.query("UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1", [hash(refreshToken)]);
}

export function clearSessionCookies(reply: FastifyReply) {
  reply.clearCookie(accessCookie, { path: "/" });
  reply.clearCookie(refreshCookie, { path: "/" });
}
