import { randomUUID } from "node:crypto";
import type { ClubRoom, ClubTournament, ClubTournamentEntry, ClubTournamentMatch, TournamentFormat } from "@dartflow/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../database.js";
import { notifyClubMembers, createNotification } from "../notifications.js";
import { publishToClub } from "../realtime.js";

const clubParams = z.object({ clubId: z.string().min(1).max(100) });
const roomParams = clubParams.extend({ roomId: z.string().uuid() });
const tournamentParams = clubParams.extend({ tournamentId: z.string().uuid() });
const matchParams = tournamentParams.extend({ matchId: z.string().uuid() });
const createRoomInput = z.object({ name: z.string().trim().min(2).max(80) });
const gameStateInput = z.object({ state: z.object({ clubId: z.string().min(1).max(100), liveRoomId: z.string().uuid(), updatedAt: z.iso.datetime(), status: z.string().max(30) }).passthrough() });
const tournamentInput = z.object({ name: z.string().trim().min(2).max(80), format: z.enum(["knockout", "round-robin"]), modeKey: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/), profileIds: z.array(z.string().min(1).max(100)).min(2).max(32) });

interface Membership { role: "owner" | "admin" | "member"; status: "pending" | "active" | "suspended" | "former" }
async function requireActive(userId: string, clubId: string, reply: FastifyReply): Promise<Membership | null> {
  await pool.query("UPDATE club_members SET status='active',suspended_until=NULL WHERE club_id=$1 AND user_id=$2 AND status='suspended' AND suspended_until<=now()", [clubId, userId]);
  const result = await pool.query<Membership>("SELECT role,status FROM club_members WHERE club_id=$1 AND user_id=$2", [clubId, userId]);
  const found = result.rows[0];
  if (!found || found.status !== "active") { reply.code(403).send({ message: "Tu n’es pas membre actif de ce club." }); return null; }
  return found;
}
const isAdmin = (role: Membership["role"]) => role === "owner" || role === "admin";

interface RoomRow { id: string; club_id: string; club_name: string; name: string; status: ClubRoom["status"]; host_user_id: string; host_username: string; scorer_user_id: string; scorer_username: string; game_state: unknown | null; game_version: number; viewer_count: string; created_at: Date; updated_at: Date }
const mapRoom = (row: RoomRow): ClubRoom => ({ id: row.id, clubId: row.club_id, clubName: row.club_name, name: row.name, status: row.status, hostUserId: row.host_user_id, hostUsername: row.host_username, scorerUserId: row.scorer_user_id, scorerUsername: row.scorer_username, ...(row.game_state ? { gameState: row.game_state } : {}), gameVersion: row.game_version, viewerCount: Number(row.viewer_count), createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
const roomSelect = `SELECT r.id,r.club_id,c.name club_name,r.name,r.status,r.host_user_id,hu.username host_username,r.scorer_user_id,su.username scorer_username,r.game_state,r.game_version,
  (SELECT COUNT(*) FROM club_room_viewers v WHERE v.room_id=r.id AND v.last_seen_at>now()-interval '45 seconds')::text viewer_count,r.created_at,r.updated_at
  FROM club_rooms r JOIN clubs c ON c.id=r.club_id JOIN users hu ON hu.id=r.host_user_id JOIN users su ON su.id=r.scorer_user_id`;

interface TournamentRow { id: string; club_id: string; name: string; format: TournamentFormat; mode_key: string; status: ClubTournament["status"]; created_by_username: string; created_at: Date; updated_at: Date }
interface EntryRow { profile_id: string; name: string; avatar: string | null; seed: number }
interface MatchRow { id: string; round: number; position: number; profile_a_id: string | null; profile_a_name: string | null; profile_a_avatar: string | null; profile_b_id: string | null; profile_b_name: string | null; profile_b_avatar: string | null; winner_profile_id: string | null; status: "scheduled" | "completed"; room_id: string | null }

async function tournamentDetails(tournamentId: string): Promise<ClubTournament | null> {
  const tournamentResult = await pool.query<TournamentRow>(`SELECT t.id,t.club_id,t.name,t.format,t.mode_key,t.status,u.username created_by_username,t.created_at,t.updated_at FROM club_tournaments t JOIN users u ON u.id=t.created_by WHERE t.id=$1`, [tournamentId]);
  const tournament = tournamentResult.rows[0]; if (!tournament) return null;
  const [entryResult, matchResult] = await Promise.all([
    pool.query<EntryRow>(`SELECT e.profile_id,p.name,COALESCE(cp.avatar,p.avatar) avatar,e.seed FROM club_tournament_entries e JOIN profiles p ON p.id=e.profile_id LEFT JOIN club_profiles cp ON cp.profile_id=p.id AND cp.club_id=$2 WHERE e.tournament_id=$1 ORDER BY e.seed`, [tournamentId, tournament.club_id]),
    pool.query<MatchRow>(`SELECT m.id,m.round,m.position,m.profile_a_id,pa.name profile_a_name,COALESCE(cpa.avatar,pa.avatar) profile_a_avatar,m.profile_b_id,pb.name profile_b_name,COALESCE(cpb.avatar,pb.avatar) profile_b_avatar,m.winner_profile_id,m.status,m.room_id
      FROM club_tournament_matches m LEFT JOIN profiles pa ON pa.id=m.profile_a_id LEFT JOIN profiles pb ON pb.id=m.profile_b_id
      LEFT JOIN club_profiles cpa ON cpa.profile_id=pa.id AND cpa.club_id=$2 LEFT JOIN club_profiles cpb ON cpb.profile_id=pb.id AND cpb.club_id=$2
      WHERE m.tournament_id=$1 ORDER BY m.round,m.position`, [tournamentId, tournament.club_id]),
  ]);
  const matches: ClubTournamentMatch[] = matchResult.rows.map((row) => ({ id: row.id, round: row.round, position: row.position, ...(row.profile_a_id && row.profile_a_name ? { profileA: { id: row.profile_a_id, name: row.profile_a_name, ...(row.profile_a_avatar ? { avatar: row.profile_a_avatar } : {}) } } : {}), ...(row.profile_b_id && row.profile_b_name ? { profileB: { id: row.profile_b_id, name: row.profile_b_name, ...(row.profile_b_avatar ? { avatar: row.profile_b_avatar } : {}) } } : {}), ...(row.winner_profile_id ? { winnerProfileId: row.winner_profile_id } : {}), status: row.status, ...(row.room_id ? { roomId: row.room_id } : {}) }));
  const entries: ClubTournamentEntry[] = entryResult.rows.map((row) => {
    const played = matches.filter((match) => match.status === "completed" && (match.profileA?.id === row.profile_id || match.profileB?.id === row.profile_id)).length;
    const wins = matches.filter((match) => match.winnerProfileId === row.profile_id).length;
    return { profileId: row.profile_id, name: row.name, ...(row.avatar ? { avatar: row.avatar } : {}), seed: row.seed, played, wins, losses: played - wins, points: wins * 3 };
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.seed - b.seed);
  return { id: tournament.id, clubId: tournament.club_id, name: tournament.name, format: tournament.format, modeKey: tournament.mode_key, status: tournament.status, createdByUsername: tournament.created_by_username, entries, matches, createdAt: tournament.created_at.toISOString(), updatedAt: tournament.updated_at.toISOString() };
}

async function advanceInitialByes(client: PoolClient, tournamentId: string): Promise<void> {
  const result = await client.query<{ id: string; position: number; profile_a_id: string | null; profile_b_id: string | null }>("SELECT id,position,profile_a_id,profile_b_id FROM club_tournament_matches WHERE tournament_id=$1 AND round=1 AND status='scheduled' ORDER BY position", [tournamentId]);
  for (const match of result.rows) {
    const winner = match.profile_a_id ?? match.profile_b_id;
    if (!winner || (match.profile_a_id && match.profile_b_id)) continue;
    await client.query("UPDATE club_tournament_matches SET winner_profile_id=$1,status='completed',updated_at=now() WHERE id=$2", [winner, match.id]);
    const column = match.position % 2 === 0 ? "profile_a_id" : "profile_b_id";
    await client.query(`UPDATE club_tournament_matches SET ${column}=$1,updated_at=now() WHERE tournament_id=$2 AND round=2 AND position=$3`, [winner, tournamentId, Math.floor(match.position / 2)]);
  }
}

const clubLiveRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:clubId/rooms", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const result = await pool.query<RoomRow>(`${roomSelect} WHERE r.club_id=$1 AND r.status<>'cancelled' ORDER BY CASE r.status WHEN 'playing' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,r.updated_at DESC LIMIT 50`, [params.data.clubId]);
    return { rooms: result.rows.map(mapRoom) };
  });

  app.post("/:clubId/rooms", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = createRoomInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Nom du salon invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const id = randomUUID();
    await pool.query("INSERT INTO club_rooms(id,club_id,host_user_id,scorer_user_id,name) VALUES($1,$2,$3,$3,$4)", [id, params.data.clubId, request.user.sub, body.data.name]);
    await notifyClubMembers(params.data.clubId, { type: "room", title: "Nouveau salon en direct", body: `${request.user.username} a créé « ${body.data.name} ».`, href: `/clubs/${params.data.clubId}/live/${id}` }, request.user.sub);
    await publishToClub(params.data.clubId, { type: "room.changed", clubId: params.data.clubId, roomId: id });
    return reply.code(201).send({ id });
  });

  app.get("/:clubId/rooms/:roomId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = roomParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Salon invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    await pool.query("INSERT INTO club_room_viewers(room_id,user_id) VALUES($1,$2) ON CONFLICT(room_id,user_id) DO UPDATE SET last_seen_at=now()", [params.data.roomId, request.user.sub]);
    const result = await pool.query<RoomRow>(`${roomSelect} WHERE r.id=$1 AND r.club_id=$2`, [params.data.roomId, params.data.clubId]);
    const room = result.rows[0]; return room ? mapRoom(room) : reply.code(404).send({ message: "Salon introuvable." });
  });

  app.post("/:clubId/rooms/:roomId/heartbeat", { preHandler: app.authenticate }, async (request, reply) => {
    const params = roomParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Salon invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    await pool.query("INSERT INTO club_room_viewers(room_id,user_id) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM club_rooms WHERE id=$1 AND club_id=$3) ON CONFLICT(room_id,user_id) DO UPDATE SET last_seen_at=now()", [params.data.roomId, request.user.sub, params.data.clubId]);
    return reply.code(204).send();
  });

  app.patch("/:clubId/rooms/:roomId/state", { preHandler: app.authenticate, bodyLimit: 2_000_000 }, async (request, reply) => {
    const params = roomParams.safeParse(request.params); const body = gameStateInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "État de partie invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const state = body.data.state;
    if (state.clubId !== params.data.clubId || state.liveRoomId !== params.data.roomId) return reply.code(400).send({ message: "Cette partie ne correspond pas au salon." });
    const status = state.status === "completed" ? "completed" : state.status === "cancelled" ? "cancelled" : "playing";
    const result = await pool.query("UPDATE club_rooms SET game_state=$1,status=$2,game_version=game_version+1,updated_at=now() WHERE id=$3 AND club_id=$4 AND scorer_user_id=$5 AND status<>'cancelled' AND (game_state IS NULL OR COALESCE(game_state->>'updatedAt','')<=$6)", [body.data.state, status, params.data.roomId, params.data.clubId, request.user.sub, state.updatedAt]);
    if (!result.rowCount) {
      const authorized = await pool.query("SELECT 1 FROM club_rooms WHERE id=$1 AND club_id=$2 AND scorer_user_id=$3 AND status<>'cancelled'", [params.data.roomId, params.data.clubId, request.user.sub]);
      if (authorized.rowCount) return { updated: false };
      return reply.code(403).send({ message: "Seul le marqueur du salon peut modifier la partie." });
    }
    await publishToClub(params.data.clubId, { type: "room.changed", clubId: params.data.clubId, roomId: params.data.roomId });
    return { updated: true };
  });

  app.patch("/:clubId/rooms/:roomId/scorer", { preHandler: app.authenticate }, async (request, reply) => {
    const params = roomParams.safeParse(request.params); const body = z.object({ userId: z.string().min(1).max(100) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Marqueur invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const room = await pool.query<{ host_user_id: string }>("SELECT host_user_id FROM club_rooms WHERE id=$1 AND club_id=$2", [params.data.roomId, params.data.clubId]);
    if (!room.rows[0] || (room.rows[0].host_user_id !== request.user.sub && !isAdmin(access.role))) return reply.code(403).send({ message: "Tu ne peux pas changer le marqueur." });
    const target = await pool.query("SELECT 1 FROM club_members WHERE club_id=$1 AND user_id=$2 AND status='active'", [params.data.clubId, body.data.userId]);
    if (!target.rowCount) return reply.code(404).send({ message: "Ce membre n’est pas actif." });
    await pool.query("UPDATE club_rooms SET scorer_user_id=$1,updated_at=now() WHERE id=$2", [body.data.userId, params.data.roomId]);
    await createNotification({ userId: body.data.userId, type: "room", title: "Tu deviens marqueur", body: "Tu peux désormais saisir les lancers de la partie en direct.", href: `/clubs/${params.data.clubId}/live/${params.data.roomId}` });
    await publishToClub(params.data.clubId, { type: "room.changed", clubId: params.data.clubId, roomId: params.data.roomId });
    return { updated: true };
  });

  app.delete("/:clubId/rooms/:roomId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = roomParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Salon invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const result = await pool.query("UPDATE club_rooms SET status='cancelled',updated_at=now() WHERE id=$1 AND club_id=$2 AND (host_user_id=$3 OR $4::boolean)", [params.data.roomId, params.data.clubId, request.user.sub, isAdmin(access.role)]);
    if (!result.rowCount) return reply.code(403).send({ message: "Tu ne peux pas fermer ce salon." });
    await publishToClub(params.data.clubId, { type: "room.changed", clubId: params.data.clubId, roomId: params.data.roomId });
    return reply.code(204).send();
  });

  app.get("/:clubId/tournaments", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const result = await pool.query<{ id: string }>("SELECT id FROM club_tournaments WHERE club_id=$1 ORDER BY created_at DESC LIMIT 30", [params.data.clubId]);
    return { tournaments: (await Promise.all(result.rows.map((row) => tournamentDetails(row.id)))).filter(Boolean) };
  });

  app.post("/:clubId/tournaments", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = tournamentInput.safeParse(request.body);
    if (!params.success || !body.success || new Set(body.data.profileIds).size !== body.data.profileIds.length) return reply.code(400).send({ message: "Configuration du tournoi invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access || !isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." });
    const allowed = await pool.query<{ profile_id: string }>("SELECT profile_id FROM club_profiles WHERE club_id=$1 AND profile_id=ANY($2::text[])", [params.data.clubId, body.data.profileIds]);
    if (allowed.rowCount !== body.data.profileIds.length) return reply.code(400).send({ message: "Tous les profils doivent appartenir au club." });
    const id = randomUUID(); const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO club_tournaments(id,club_id,created_by,name,format,mode_key) VALUES($1,$2,$3,$4,$5,$6)", [id, params.data.clubId, request.user.sub, body.data.name, body.data.format, body.data.modeKey]);
      for (const [index, profileId] of body.data.profileIds.entries()) await client.query("INSERT INTO club_tournament_entries(tournament_id,profile_id,seed) VALUES($1,$2,$3)", [id, profileId, index + 1]);
      if (body.data.format === "round-robin") {
        let position = 0;
        for (let left = 0; left < body.data.profileIds.length; left += 1) for (let right = left + 1; right < body.data.profileIds.length; right += 1) {
          await client.query("INSERT INTO club_tournament_matches(id,tournament_id,round,position,profile_a_id,profile_b_id) VALUES($1,$2,1,$3,$4,$5)", [randomUUID(), id, position, body.data.profileIds[left], body.data.profileIds[right]]); position += 1;
        }
      } else {
        const size = 2 ** Math.ceil(Math.log2(body.data.profileIds.length)); const rounds = Math.log2(size); const byes = size - body.data.profileIds.length;
        for (let round = 1; round <= rounds; round += 1) for (let position = 0; position < size / 2 ** round; position += 1) {
          const firstProfileIndex = position < byes ? position : byes + (position - byes) * 2;
          const profileA = round === 1 ? body.data.profileIds[firstProfileIndex] ?? null : null; const profileB = round === 1 && position >= byes ? body.data.profileIds[firstProfileIndex + 1] ?? null : null;
          await client.query("INSERT INTO club_tournament_matches(id,tournament_id,round,position,profile_a_id,profile_b_id) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), id, round, position, profileA, profileB]);
        }
        await advanceInitialByes(client, id);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await notifyClubMembers(params.data.clubId, { type: "tournament", title: "Nouveau tournoi", body: `${body.data.name} vient d’être créé.`, href: `/clubs/${params.data.clubId}/tournaments/${id}` }, request.user.sub);
    await publishToClub(params.data.clubId, { type: "tournament.changed", clubId: params.data.clubId, tournamentId: id });
    return reply.code(201).send({ id });
  });

  app.get("/:clubId/tournaments/:tournamentId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = tournamentParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Tournoi invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const tournament = await tournamentDetails(params.data.tournamentId);
    return tournament?.clubId === params.data.clubId ? tournament : reply.code(404).send({ message: "Tournoi introuvable." });
  });

  app.patch("/:clubId/tournaments/:tournamentId/matches/:matchId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = matchParams.safeParse(request.params); const body = z.object({ winnerProfileId: z.string().min(1).max(100) }).safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Résultat invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access || !isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." });
    const match = await pool.query<{ round: number; position: number; profile_a_id: string | null; profile_b_id: string | null; format: TournamentFormat; status: "scheduled" | "completed" }>(`SELECT m.round,m.position,m.profile_a_id,m.profile_b_id,m.status,t.format FROM club_tournament_matches m JOIN club_tournaments t ON t.id=m.tournament_id WHERE m.id=$1 AND m.tournament_id=$2 AND t.club_id=$3`, [params.data.matchId, params.data.tournamentId, params.data.clubId]);
    const found = match.rows[0]; if (!found || ![found.profile_a_id, found.profile_b_id].includes(body.data.winnerProfileId)) return reply.code(400).send({ message: "Le gagnant doit participer à cette rencontre." });
    if (found.status === "completed") return reply.code(409).send({ message: "Cette rencontre possède déjà un résultat." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE club_tournament_matches SET winner_profile_id=$1,status='completed',updated_at=now() WHERE id=$2", [body.data.winnerProfileId, params.data.matchId]);
      if (found.format === "knockout") {
        const next = await client.query<{ id: string }>("SELECT id FROM club_tournament_matches WHERE tournament_id=$1 AND round=$2 AND position=$3", [params.data.tournamentId, found.round + 1, Math.floor(found.position / 2)]);
        if (next.rows[0]) { const column = found.position % 2 === 0 ? "profile_a_id" : "profile_b_id"; await client.query(`UPDATE club_tournament_matches SET ${column}=$1,updated_at=now() WHERE id=$2`, [body.data.winnerProfileId, next.rows[0].id]); }
        else await client.query("UPDATE club_tournaments SET status='completed',updated_at=now() WHERE id=$1", [params.data.tournamentId]);
      } else {
        const pending = await client.query("SELECT 1 FROM club_tournament_matches WHERE tournament_id=$1 AND status='scheduled' AND id<>$2 LIMIT 1", [params.data.tournamentId, params.data.matchId]);
        if (!pending.rowCount) await client.query("UPDATE club_tournaments SET status='completed',updated_at=now() WHERE id=$1", [params.data.tournamentId]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await publishToClub(params.data.clubId, { type: "tournament.changed", clubId: params.data.clubId, tournamentId: params.data.tournamentId });
    return { updated: true };
  });

  app.post("/:clubId/tournaments/:tournamentId/matches/:matchId/room", { preHandler: app.authenticate }, async (request, reply) => {
    const params = matchParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Rencontre invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const match = await pool.query<{ profile_a_name: string | null; profile_b_name: string | null; room_id: string | null }>(`SELECT pa.name profile_a_name,pb.name profile_b_name,m.room_id FROM club_tournament_matches m JOIN club_tournaments t ON t.id=m.tournament_id LEFT JOIN profiles pa ON pa.id=m.profile_a_id LEFT JOIN profiles pb ON pb.id=m.profile_b_id WHERE m.id=$1 AND m.tournament_id=$2 AND t.club_id=$3`, [params.data.matchId, params.data.tournamentId, params.data.clubId]);
    const found = match.rows[0]; if (!found || !found.profile_a_name || !found.profile_b_name) return reply.code(400).send({ message: "Cette rencontre n’est pas encore prête." });
    if (found.room_id) return { id: found.room_id };
    const id = randomUUID(); const name = `${found.profile_a_name} vs ${found.profile_b_name}`.slice(0, 80);
    const client = await pool.connect(); try { await client.query("BEGIN"); await client.query("INSERT INTO club_rooms(id,club_id,host_user_id,scorer_user_id,name) VALUES($1,$2,$3,$3,$4)", [id, params.data.clubId, request.user.sub, name]); await client.query("UPDATE club_tournament_matches SET room_id=$1,updated_at=now() WHERE id=$2", [id, params.data.matchId]); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await publishToClub(params.data.clubId, { type: "room.changed", clubId: params.data.clubId, roomId: id });
    return reply.code(201).send({ id });
  });
};

export default clubLiveRoutes;
