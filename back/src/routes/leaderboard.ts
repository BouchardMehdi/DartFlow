import type { LeaderboardRow } from "@dartflow/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";

const querySchema = z.object({ mode: z.enum(["count-up", "301", "501", "701", "around-the-clock", "shanghai", "cricket", "killer"]).optional() });
interface Row { profile_id: string; name: string; owner_username: string; games: string; wins: string; darts_thrown: string; points_scored: string; best_turn: number }

const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query); if (!parsed.success) return reply.code(400).send({ message: "Filtre invalide." });
    const params: unknown[] = [];
    const selectedMode = parsed.data.mode;
    const modeFilter = selectedMode === "301" || selectedMode === "501" || selectedMode === "701"
      ? (params.push("x01", selectedMode), "AND g.mode_id=$1 AND g.state->'modeState'->>'startingScore'=$2")
      : selectedMode
        ? (params.push(selectedMode), "AND g.mode_id=$1")
        : "AND g.mode_id<>'training'";
    const result = await pool.query<Row>(`SELECT p.id profile_id,p.name,u.username owner_username,COUNT(DISTINCT gp.game_id)::text games,
      COUNT(DISTINCT gp.game_id) FILTER(WHERE gp.is_winner)::text wins,COALESCE(SUM(gp.darts_thrown),0)::text darts_thrown,
      COALESCE(SUM(gp.points_scored),0)::text points_scored,COALESCE(MAX(gp.best_turn),0) best_turn
      FROM profiles p JOIN users u ON u.id=p.owner_user_id JOIN game_participants gp ON gp.profile_id=p.id JOIN games g ON g.id=gp.game_id
      WHERE p.is_public=true AND p.deleted_at IS NULL AND g.status='completed' AND g.deleted_at IS NULL ${modeFilter}
      GROUP BY p.id,p.name,u.username ORDER BY COUNT(DISTINCT gp.game_id) FILTER(WHERE gp.is_winner) DESC,
      (COUNT(DISTINCT gp.game_id) FILTER(WHERE gp.is_winner))::numeric/NULLIF(COUNT(DISTINCT gp.game_id),0) DESC,
      COALESCE(SUM(gp.points_scored),0)::numeric/NULLIF(SUM(gp.darts_thrown),0) DESC`, params);
    const rows: LeaderboardRow[] = result.rows.map((row, index) => { const games=Number(row.games); const wins=Number(row.wins); const darts=Number(row.darts_thrown); const points=Number(row.points_scored); return { rank:index+1,profileId:row.profile_id,name:row.name,ownerUsername:row.owner_username,games,wins,winRate:games?wins/games*100:0,dartsThrown:darts,averagePerDart:darts?points/darts:0,bestTurn:row.best_turn }; });
    return { rows, generatedAt: new Date().toISOString() };
  });
};

export default leaderboardRoutes;
