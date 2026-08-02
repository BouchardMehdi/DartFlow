import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { buildLeaderboard, type LeaderboardGameRow, type PublicProfileRow } from "../domain.js";

const querySchema = z.object({ mode: z.string().max(40).optional() });

const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query); if (!parsed.success) return reply.code(400).send({ message: "Filtre invalide." });
    const [profiles, games] = await Promise.all([
      pool.query<PublicProfileRow>("SELECT id,name FROM profiles WHERE is_public=true AND deleted_at IS NULL"),
      parsed.data.mode
        ? pool.query<LeaderboardGameRow>("SELECT mode_id,state FROM games WHERE status='completed' AND deleted_at IS NULL AND mode_id=$1", [parsed.data.mode])
        : pool.query<LeaderboardGameRow>("SELECT mode_id,state FROM games WHERE status='completed' AND deleted_at IS NULL AND mode_id <> 'training'"),
    ]);
    return { rows: buildLeaderboard(profiles.rows, games.rows), generatedAt: new Date().toISOString() };
  });
};

export default leaderboardRoutes;
