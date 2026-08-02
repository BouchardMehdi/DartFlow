import { randomUUID } from "node:crypto";
import type { FriendsResponse } from "@dartflow/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { normalizeUsername } from "../domain.js";

const userParams = z.object({ userId: z.string().min(1).max(100) });
const pair = (first: string, second: string) => first < second ? [first, second] : [second, first];

const friendRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const result = await pool.query<{ other_id: string; username: string; status: "pending" | "accepted"; requested_by: string; created_at: Date; updated_at: Date }>(`SELECT CASE WHEN f.user_id_a=$1 THEN f.user_id_b ELSE f.user_id_a END other_id,u.username,f.status,f.requested_by,f.created_at,f.updated_at
      FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_id_a=$1 THEN f.user_id_b ELSE f.user_id_a END
      WHERE f.user_id_a=$1 OR f.user_id_b=$1 ORDER BY u.username`, [request.user.sub]);
    const response: FriendsResponse = {
      friends: result.rows.filter((row) => row.status === "accepted").map((row) => ({ userId: row.other_id, username: row.username, since: row.updated_at.toISOString() })),
      requests: result.rows.filter((row) => row.status === "pending").map((row) => ({ userId: row.other_id, username: row.username, direction: row.requested_by === request.user.sub ? "outgoing" : "incoming", createdAt: row.created_at.toISOString() })),
    };
    return response;
  });

  app.get("/search", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ q: z.string().trim().min(2).max(24) }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ message: "Recherche trop courte." });
    const result = await pool.query<{ id: string; username: string }>("SELECT id,username FROM users WHERE id<>$1 AND lower(username) LIKE $2 ORDER BY username LIMIT 10", [request.user.sub, `${normalizeUsername(parsed.data.q)}%`]);
    return { users: result.rows.map((row) => ({ userId: row.id, username: row.username })) };
  });

  app.post("/requests", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ username: z.string().trim().min(3).max(24) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Nom d’utilisateur invalide." });
    const target = await pool.query<{ id: string }>("SELECT id FROM users WHERE lower(username)=$1", [normalizeUsername(parsed.data.username)]);
    const targetId = target.rows[0]?.id;
    if (!targetId || targetId === request.user.sub) return reply.code(404).send({ message: "Compte introuvable." });
    const [a, b] = pair(request.user.sub, targetId);
    const existing = await pool.query<{ status: string; requested_by: string }>("SELECT status,requested_by FROM friendships WHERE user_id_a=$1 AND user_id_b=$2", [a, b]);
    if (existing.rows[0]?.status === "accepted") return reply.code(409).send({ message: "Ce compte est déjà dans tes amis." });
    if (existing.rows[0]) return reply.code(409).send({ message: existing.rows[0].requested_by === request.user.sub ? "Demande déjà envoyée." : "Ce compte t’a déjà envoyé une demande." });
    await pool.query("INSERT INTO friendships(user_id_a,user_id_b,requested_by,status) VALUES($1,$2,$3,'pending')", [a, b, request.user.sub]);
    return reply.code(201).send({ id: randomUUID(), status: "pending" });
  });

  app.post("/requests/:userId/accept", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = userParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Demande invalide." });
    const [a, b] = pair(request.user.sub, parsed.data.userId);
    const result = await pool.query("UPDATE friendships SET status='accepted',updated_at=now() WHERE user_id_a=$1 AND user_id_b=$2 AND status='pending' AND requested_by=$3", [a, b, parsed.data.userId]);
    return result.rowCount ? { status: "accepted" } : reply.code(404).send({ message: "Demande introuvable." });
  });

  app.delete("/:userId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = userParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Ami invalide." });
    const [a, b] = pair(request.user.sub, parsed.data.userId);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const removed = await client.query("DELETE FROM friendships WHERE user_id_a=$1 AND user_id_b=$2", [a, b]);
      await client.query(`DELETE FROM profile_access pa USING profiles p WHERE pa.profile_id=p.id AND ((p.owner_user_id=$1 AND pa.user_id=$2) OR (p.owner_user_id=$2 AND pa.user_id=$1))`, [request.user.sub, parsed.data.userId]);
      await client.query("COMMIT");
      return removed.rowCount ? reply.code(204).send() : reply.code(404).send({ message: "Relation introuvable." });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  });
};

export default friendRoutes;
