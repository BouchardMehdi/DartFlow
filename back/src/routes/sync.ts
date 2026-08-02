import { randomUUID } from "node:crypto";
import type { CloudGame, CloudProfile, SyncResponse } from "@dartflow/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { normalizeName, remapIdentifiers } from "../domain.js";

const profileSchema = z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(40), color: z.string().max(100).optional(), avatar: z.string().max(2000).optional(), updatedAt: z.iso.datetime() });
const gameSchema = z.object({ id: z.string().min(1).max(100), modeId: z.string().min(1).max(40), status: z.string().min(1).max(30), state: z.record(z.string(), z.unknown()), updatedAt: z.iso.datetime() });
const syncSchema = z.object({ profiles: z.array(profileSchema).max(500), games: z.array(gameSchema).max(5000), deletedGameIds: z.array(z.string().min(1).max(100)).max(5000) });

interface ProfileDbRow { id: string; name: string; normalized_name: string; color: string | null; avatar: string | null; is_public: boolean; role: "owner" | "editor" | "viewer"; owner_email: string; created_at: Date; updated_at: Date }
interface GameDbRow { id: string; mode_id: string; status: string; state: unknown; version: number; updated_at: Date }

const mapProfile = (row: ProfileDbRow): CloudProfile => ({ id: row.id, name: row.name, normalizedName: row.normalized_name, ...(row.color ? { color: row.color } : {}), ...(row.avatar ? { avatar: row.avatar } : {}), isPublic: row.is_public, role: row.role, ownerEmail: row.owner_email, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
const mapGame = (row: GameDbRow): CloudGame => ({ id: row.id, modeId: row.mode_id, status: row.status, state: row.state, version: row.version, updatedAt: row.updated_at.toISOString() });

async function cloudState(userId: string): Promise<{ profiles: CloudProfile[]; games: CloudGame[] }> {
  const [profileResult, gameResult] = await Promise.all([
    pool.query<ProfileDbRow>(`SELECT p.id, p.name, p.normalized_name, p.color, p.avatar, p.is_public, p.created_at, p.updated_at, u.email owner_email,
      CASE WHEN p.owner_user_id = $1 THEN 'owner' ELSE pa.role END role
      FROM profiles p JOIN users u ON u.id = p.owner_user_id LEFT JOIN profile_access pa ON pa.profile_id = p.id AND pa.user_id = $1
      WHERE p.deleted_at IS NULL AND (p.owner_user_id = $1 OR pa.user_id = $1) ORDER BY p.updated_at DESC`, [userId]),
    pool.query<GameDbRow>("SELECT id, mode_id, status, state, version, updated_at FROM games WHERE owner_user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC", [userId]),
  ]);
  return { profiles: profileResult.rows.map(mapProfile), games: gameResult.rows.map(mapGame) };
}

const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", { preHandler: app.authenticate, bodyLimit: 15_000_000 }, async (request, reply) => {
    const parsed = syncSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: "Données de synchronisation invalides.", details: parsed.error.flatten() });
    const userId = request.user.sub;
    const mappings: Record<string, string> = {};
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const profile of parsed.data.profiles) {
        const normalized = normalizeName(profile.name);
        const existing = await client.query<{ id: string }>("SELECT id FROM profiles WHERE owner_user_id = $1 AND normalized_name = $2 AND deleted_at IS NULL", [userId, normalized]);
        const canonicalId = existing.rows[0]?.id ?? profile.id;
        if (canonicalId !== profile.id) mappings[profile.id] = canonicalId;
        const idOwner = await client.query<{ owner_user_id: string }>("SELECT owner_user_id FROM profiles WHERE id = $1", [canonicalId]);
        const safeId = idOwner.rows[0] && idOwner.rows[0].owner_user_id !== userId ? randomUUID() : canonicalId;
        if (safeId !== profile.id) mappings[profile.id] = safeId;
        await client.query(`INSERT INTO profiles(id, owner_user_id, name, normalized_name, color, avatar, created_at, updated_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$7)
          ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, normalized_name = EXCLUDED.normalized_name, color = EXCLUDED.color, avatar = EXCLUDED.avatar, updated_at = EXCLUDED.updated_at
          WHERE profiles.owner_user_id = $2 AND profiles.updated_at <= EXCLUDED.updated_at`, [safeId, userId, profile.name.trim().replace(/\s+/g, " "), normalized, profile.color ?? null, profile.avatar ?? null, profile.updatedAt]);
      }
      for (const game of parsed.data.games) {
        const state = remapIdentifiers(game.state, mappings);
        await client.query(`INSERT INTO games(id, owner_user_id, mode_id, status, state, client_updated_at)
          VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT(id) DO UPDATE SET mode_id = EXCLUDED.mode_id, status = EXCLUDED.status, state = EXCLUDED.state,
            client_updated_at = EXCLUDED.client_updated_at, updated_at = now(), version = games.version + 1, deleted_at = NULL
          WHERE games.owner_user_id = $2 AND games.client_updated_at <= EXCLUDED.client_updated_at`, [game.id, userId, game.modeId, game.status, state, game.updatedAt]);
      }
      if (parsed.data.deletedGameIds.length) await client.query("UPDATE games SET deleted_at = now(), updated_at = now(), version = version + 1 WHERE owner_user_id = $1 AND id = ANY($2::text[])", [userId, parsed.data.deletedGameIds]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    const state = await cloudState(userId);
    const response: SyncResponse = { ...state, profileIdMappings: mappings, syncedAt: new Date().toISOString() };
    return response;
  });
};

export default syncRoutes;
