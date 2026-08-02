import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { normalizeName } from "../domain.js";

const paramsSchema = z.object({ id: z.string().min(1).max(100) });
const updateSchema = z.object({ name: z.string().trim().min(1).max(40).optional(), color: z.string().max(100).nullable().optional(), avatar: z.string().max(2000).nullable().optional(), isPublic: z.boolean().optional() });
const shareSchema = z.object({ userId: z.string().min(1).max(100), role: z.enum(["manager", "player"]) });
const pair = (first: string, second: string) => first < second ? [first, second] : [second, first];

const profileRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params); const body = updateSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Modification invalide." });
    const access = await pool.query<{ role: string }>(`SELECT CASE WHEN p.owner_user_id=$2 THEN 'owner' ELSE pa.role END role FROM profiles p LEFT JOIN profile_access pa ON pa.profile_id=p.id AND pa.user_id=$2 WHERE p.id=$1 AND p.deleted_at IS NULL AND (p.owner_user_id=$2 OR pa.user_id=$2)`, [params.data.id, request.user.sub]);
    const role = access.rows[0]?.role;
    if (!role || role === "player") return reply.code(403).send({ message: "Tu ne peux pas modifier ce profil." });
    if (body.data.isPublic !== undefined && role !== "owner") return reply.code(403).send({ message: "Seul le propriétaire peut publier ce profil." });
    const fields: string[] = []; const values: unknown[] = [];
    const add = (sql: string, value: unknown) => { values.push(value); fields.push(`${sql}=$${values.length}`); };
    if (body.data.name !== undefined) { add("name", body.data.name.trim().replace(/\s+/g, " ")); add("normalized_name", normalizeName(body.data.name)); }
    if (body.data.color !== undefined) add("color", body.data.color);
    if (body.data.avatar !== undefined) add("avatar", body.data.avatar);
    if (body.data.isPublic !== undefined) add("is_public", body.data.isPublic);
    if (!fields.length) return reply.code(204).send();
    values.push(params.data.id); await pool.query(`UPDATE profiles SET ${fields.join(",")},updated_at=now() WHERE id=$${values.length}`, values);
    return { success: true };
  });

  app.get("/:id/shares", { preHandler: app.authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Profil invalide." });
    const owner = await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND owner_user_id=$2", [params.data.id, request.user.sub]);
    if (!owner.rowCount) return reply.code(403).send({ message: "Seul le propriétaire peut gérer les partages." });
    const members = await pool.query<{ user_id: string; username: string; role: "manager" | "player" }>("SELECT u.id user_id,u.username,pa.role FROM profile_access pa JOIN users u ON u.id=pa.user_id WHERE pa.profile_id=$1 ORDER BY u.username", [params.data.id]);
    return { shares: members.rows.map((row) => ({ userId: row.user_id, username: row.username, role: row.role })) };
  });

  app.post("/:id/shares", { preHandler: app.authenticate }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params); const body = shareSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Partage invalide." });
    const owner = await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND owner_user_id=$2", [params.data.id, request.user.sub]);
    if (!owner.rowCount) return reply.code(403).send({ message: "Seul le propriétaire peut partager ce profil." });
    const [a, b] = pair(request.user.sub, body.data.userId);
    const friend = await pool.query("SELECT 1 FROM friendships WHERE user_id_a=$1 AND user_id_b=$2 AND status='accepted'", [a, b]);
    if (!friend.rowCount) return reply.code(403).send({ message: "Ce profil peut uniquement être partagé avec un ami." });
    await pool.query("INSERT INTO profile_access(profile_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(profile_id,user_id) DO UPDATE SET role=EXCLUDED.role", [params.data.id, body.data.userId, body.data.role]);
    return { status: "shared" };
  });

  app.delete("/:id/shares/:userId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ id: z.string(), userId: z.string() }).safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Partage invalide." });
    const result = await pool.query("DELETE FROM profile_access USING profiles WHERE profile_access.profile_id=profiles.id AND profiles.id=$1 AND profiles.owner_user_id=$2 AND profile_access.user_id=$3", [parsed.data.id, request.user.sub, parsed.data.userId]);
    return result.rowCount ? reply.code(204).send() : reply.code(404).send({ message: "Partage introuvable." });
  });
};

export default profileRoutes;
