import { randomBytes, randomUUID } from "node:crypto";
import type { ClubChat, ClubDetail, ClubGameMode, ClubMember, ClubMessage, ClubProfile, ClubStatisticRow, ClubStatistics, ClubSummary } from "@dartflow/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { pool } from "../database.js";
import { normalizeName } from "../domain.js";

const clubParams = z.object({ clubId: z.string().min(1).max(100) });
const statisticsQuery = z.object({ mode: z.string().max(60).regex(/^[a-z0-9-]+$/).default("all") });
const memberParams = clubParams.extend({ userId: z.string().min(1).max(100) });
const profileParams = clubParams.extend({ profileId: z.string().min(1).max(100) });
const messageParams = clubParams.extend({ messageId: z.string().uuid() });
const clubInput = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).default(""), visibility: z.enum(["private", "public"]).default("private") });
const clubUpdateInput = z.object({ name: z.string().trim().min(2).max(60).optional(), description: z.string().trim().max(300).optional(), visibility: z.enum(["private", "public"]).optional() }).refine((value) => Object.values(value).some((item) => item !== undefined));
const guestInput = z.object({ name: z.string().trim().min(1).max(30), color: z.string().max(100).optional() });
const avatarInput = z.object({ avatar: z.string().max(750_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable() });
const messageInput = z.object({ content: z.string().trim().min(1).max(1000) });
const code = () => randomBytes(6).toString("hex").toUpperCase();
const slugBase = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "club";
const gameModeKeySql = `CASE
  WHEN g.mode_id='x01' THEN 'x01-' || COALESCE(g.state#>>'{modeState,startingScore}','inconnu')
  WHEN g.mode_id='cricket' THEN 'cricket-' || COALESCE(g.state#>>'{modeState,variant}','standard')
  WHEN g.mode_id='training' THEN 'training-' || COALESCE(g.state#>>'{modeState,trainingType}','inconnu')
  ELSE g.mode_id END`;
const gameModeLabel = (key: string): string => {
  const labels: Record<string, string> = { "count-up": "Count-Up", "x01-301": "301", "x01-501": "501", "x01-701": "701", "around-the-clock": "Around the Clock", shanghai: "Shanghai", "cricket-standard": "Cricket standard", "cricket-no-score": "Cricket sans points", "cricket-cut-throat": "Cut-Throat Cricket", killer: "Killer", "training-doubles": "Entraînement doubles", "training-triples": "Entraînement triples", "training-checkout": "Checkout Challenge", "training-bobs-27": "Bob’s 27", "training-random-target": "Cible aléatoire" };
  return labels[key] ?? key;
};

interface Membership { role: "owner" | "admin" | "member"; status: "pending" | "active" | "former" }
async function membership(userId: string, clubId: string): Promise<Membership | null> {
  const result = await pool.query<Membership>("SELECT role,status FROM club_members WHERE club_id=$1 AND user_id=$2", [clubId, userId]);
  return result.rows[0] ?? null;
}
async function requireActive(userId: string, clubId: string, reply: FastifyReply): Promise<Membership | null> {
  const found = await membership(userId, clubId);
  if (!found || found.status !== "active") { reply.code(403).send({ message: "Tu n’es pas membre actif de ce club." }); return null; }
  return found;
}
const isAdmin = (role: Membership["role"]) => role === "owner" || role === "admin";

interface ClubRow { id: string; name: string; avatar: string | null; slug: string; description: string; visibility: "private" | "public"; invite_code: string; role?: Membership["role"]; membership_status?: Membership["status"]; member_count: string; profile_count: string; created_at: Date }
const mapClub = (row: ClubRow): ClubSummary => ({ id: row.id, name: row.name, ...(row.avatar ? { avatar: row.avatar } : {}), slug: row.slug, description: row.description, visibility: row.visibility, ...(row.role ? { role: row.role } : {}), ...(row.membership_status ? { membershipStatus: row.membership_status } : {}), memberCount: Number(row.member_count), profileCount: Number(row.profile_count), createdAt: row.created_at.toISOString() });

async function profilesForClub(clubId: string, userId: string, administrator: boolean): Promise<ClubProfile[]> {
  const result = await pool.query<{ id: string; name: string; color: string | null; avatar: string | null; avatar_override: boolean; owner_user_id: string; owner_username: string; kind: "personal" | "guest" }>(`SELECT p.id,p.name,p.color,COALESCE(cp.avatar,p.avatar) avatar,(cp.avatar IS NOT NULL) avatar_override,p.owner_user_id,
    CASE WHEN p.guest_club_id IS NOT NULL THEN c.name ELSE u.username END owner_username,
    CASE WHEN p.guest_club_id IS NOT NULL THEN 'guest' ELSE 'personal' END kind
    FROM club_profiles cp JOIN profiles p ON p.id=cp.profile_id JOIN users u ON u.id=p.owner_user_id JOIN clubs c ON c.id=cp.club_id
    WHERE cp.club_id=$1 AND p.deleted_at IS NULL ORDER BY p.name`, [clubId]);
  return result.rows.map((row) => ({ id: row.id, name: row.name, ...(row.color ? { color: row.color } : {}), ...(row.avatar ? { avatar: row.avatar } : {}), hasCustomAvatar: row.avatar_override, ownerUserId: row.owner_user_id, ownerUsername: row.owner_username, kind: row.kind, canManage: row.owner_user_id === userId || (administrator && row.kind === "guest") }));
}

const clubRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const clubs = await pool.query<ClubRow>(`SELECT c.*,cm.role,cm.status membership_status,
      (SELECT COUNT(*) FROM club_members m WHERE m.club_id=c.id AND m.status='active')::text member_count,
      (SELECT COUNT(*) FROM club_profiles cp WHERE cp.club_id=c.id)::text profile_count
      FROM clubs c JOIN club_members cm ON cm.club_id=c.id AND cm.user_id=$1 WHERE cm.status IN ('active','pending') ORDER BY c.updated_at DESC`, [request.user.sub]);
    const discover = await pool.query<ClubRow>(`SELECT c.*,(SELECT COUNT(*) FROM club_members m WHERE m.club_id=c.id AND m.status='active')::text member_count,
      (SELECT COUNT(*) FROM club_profiles cp WHERE cp.club_id=c.id)::text profile_count
      FROM clubs c WHERE c.visibility='public' AND NOT EXISTS(SELECT 1 FROM club_members cm WHERE cm.club_id=c.id AND cm.user_id=$1 AND cm.status IN ('active','pending')) ORDER BY member_count DESC,c.name LIMIT 30`, [request.user.sub]);
    return { clubs: clubs.rows.map(mapClub), discover: discover.rows.map(mapClub) };
  });

  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubInput.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Informations du club invalides." });
    const id = randomUUID(); const base = slugBase(parsed.data.name);
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt += 1) { const exists = await pool.query("SELECT 1 FROM clubs WHERE slug=$1", [slug]); if (!exists.rowCount) break; slug = `${base}-${randomBytes(2).toString("hex")}`; }
    const client = await pool.connect();
    try { await client.query("BEGIN"); await client.query("INSERT INTO clubs(id,owner_user_id,name,slug,description,visibility,invite_code) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, request.user.sub, parsed.data.name, slug, parsed.data.description, parsed.data.visibility, code()]); await client.query("INSERT INTO club_members(club_id,user_id,role,status,invited_by,joined_at) VALUES($1,$2,'owner','active',$2,now())", [id, request.user.sub]); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return reply.code(201).send({ id, slug });
  });

  app.post("/join-code", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = z.object({ code: z.string().trim().min(6).max(32) }).safeParse(request.body); if (!parsed.success) return reply.code(400).send({ message: "Code invalide." });
    const club = await pool.query<{ id: string }>("SELECT id FROM clubs WHERE upper(invite_code)=upper($1)", [parsed.data.code]); const clubId = club.rows[0]?.id;
    if (!clubId) return reply.code(404).send({ message: "Ce code d’invitation n’existe pas." });
    await pool.query(`INSERT INTO club_members(club_id,user_id,role,status,joined_at) VALUES($1,$2,'member','active',now())
      ON CONFLICT(club_id,user_id) DO UPDATE SET role=CASE WHEN club_members.status='active' THEN club_members.role ELSE 'member' END,status='active',joined_at=COALESCE(club_members.joined_at,now()),left_at=NULL`, [clubId, request.user.sub]);
    return { clubId };
  });

  app.post("/:clubId/join", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Club invalide." });
    const club = await pool.query<{ visibility: string }>("SELECT visibility FROM clubs WHERE id=$1", [parsed.data.clubId]);
    if (club.rows[0]?.visibility !== "public") return reply.code(403).send({ message: "Ce club est accessible uniquement sur invitation." });
    await pool.query(`INSERT INTO club_members(club_id,user_id,role,status) VALUES($1,$2,'member','pending')
      ON CONFLICT(club_id,user_id) DO UPDATE SET status=CASE WHEN club_members.status='former' THEN 'pending' ELSE club_members.status END,left_at=NULL`, [parsed.data.clubId, request.user.sub]);
    return reply.code(202).send({ status: "pending" });
  });

  app.get("/:clubId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    const admin = isAdmin(access.role);
    const clubResult = await pool.query<ClubRow>(`SELECT c.*,cm.role,cm.status membership_status,
      (SELECT COUNT(*) FROM club_members m WHERE m.club_id=c.id AND m.status='active')::text member_count,
      (SELECT COUNT(*) FROM club_profiles cp WHERE cp.club_id=c.id)::text profile_count
      FROM clubs c JOIN club_members cm ON cm.club_id=c.id AND cm.user_id=$2 WHERE c.id=$1`, [parsed.data.clubId, request.user.sub]);
    const clubRow = clubResult.rows[0]; if (!clubRow) return reply.code(404).send({ message: "Club introuvable." });
    const [memberResult, availableResult, profiles] = await Promise.all([
      pool.query<{ user_id: string; username: string; avatar: string | null; role: ClubMember["role"]; status: ClubMember["status"]; joined_at: Date | null }>(`SELECT cm.user_id,u.username,u.avatar,cm.role,cm.status,cm.joined_at FROM club_members cm JOIN users u ON u.id=cm.user_id WHERE cm.club_id=$1 AND cm.status IN ('active','pending') ORDER BY cm.status,cm.role,u.username`, [parsed.data.clubId]),
      pool.query<{ id: string; name: string; color: string | null; avatar: string | null; owner_user_id: string; owner_username: string }>(`SELECT p.id,p.name,p.color,p.avatar,p.owner_user_id,u.username owner_username FROM profiles p JOIN users u ON u.id=p.owner_user_id WHERE p.owner_user_id=$1 AND p.guest_club_id IS NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM club_profiles cp WHERE cp.club_id=$2 AND cp.profile_id=p.id) ORDER BY p.name`, [request.user.sub, parsed.data.clubId]),
      profilesForClub(parsed.data.clubId, request.user.sub, admin),
    ]);
    const members: ClubMember[] = memberResult.rows.map((row) => ({ userId: row.user_id, username: row.username, ...(row.avatar ? { avatar: row.avatar } : {}), role: row.role, status: row.status, ...(row.joined_at ? { joinedAt: row.joined_at.toISOString() } : {}) }));
    const availableProfiles: ClubProfile[] = availableResult.rows.map((row) => ({ id: row.id, name: row.name, ...(row.color ? { color: row.color } : {}), ...(row.avatar ? { avatar: row.avatar } : {}), hasCustomAvatar: false, ownerUserId: row.owner_user_id, ownerUsername: row.owner_username, kind: "personal", canManage: true }));
    const detail: ClubDetail = { club: { ...mapClub(clubRow), ...(admin ? { inviteCode: clubRow.invite_code } : {}) }, members, profiles, availableProfiles };
    return detail;
  });

  app.patch("/:clubId/avatar", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = avatarInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Photo du club invalide ou trop volumineuse." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    await pool.query("UPDATE clubs SET avatar=$1,updated_at=now() WHERE id=$2", [body.data.avatar, params.data.clubId]);
    return { updated: true };
  });

  app.patch("/:clubId/profiles/:profileId/avatar", { preHandler: app.authenticate }, async (request, reply) => {
    const params = profileParams.safeParse(request.params); const body = avatarInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Photo du profil invalide ou trop volumineuse." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const result = await pool.query("UPDATE club_profiles SET avatar=$1 WHERE club_id=$2 AND profile_id=$3", [body.data.avatar, params.data.clubId, params.data.profileId]);
    return result.rowCount ? { updated: true } : reply.code(404).send({ message: "Ce profil n’appartient pas au club." });
  });

  app.get("/:clubId/play-profiles", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    const club = await pool.query<{ name: string }>("SELECT name FROM clubs WHERE id=$1", [parsed.data.clubId]);
    return { clubName: club.rows[0]?.name ?? "Club", profiles: await profilesForClub(parsed.data.clubId, request.user.sub, isAdmin(access.role)) };
  });

  app.get("/:clubId/statistics", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const query = statisticsQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ message: "Filtre statistique invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const [clubResult, modeResult] = await Promise.all([
      pool.query<{ id: string; name: string; avatar: string | null }>("SELECT id,name,avatar FROM clubs WHERE id=$1", [params.data.clubId]),
      pool.query<{ mode_key: string }>(`SELECT DISTINCT ${gameModeKeySql} mode_key FROM games g WHERE g.club_id=$1 AND g.status='completed' AND g.deleted_at IS NULL ORDER BY mode_key`, [params.data.clubId]),
    ]);
    const club = clubResult.rows[0]; if (!club) return reply.code(404).send({ message: "Club introuvable." });
    const modes: ClubGameMode[] = modeResult.rows.map((row) => ({ key: row.mode_key, label: gameModeLabel(row.mode_key) }));
    if (query.data.mode !== "all" && !modes.some((mode) => mode.key === query.data.mode)) return reply.code(400).send({ message: "Ce mode ne possède aucune partie dans le club." });
    const statsResult = await pool.query<{ profile_id: string; name: string; avatar: string | null; owner_username: string; kind: "personal" | "guest"; games: string; wins: string; darts: string; turns: string; points: string; best_turn: number }>(`WITH club_players AS (
      SELECT p.id profile_id,p.name,COALESCE(cp.avatar,p.avatar) avatar,CASE WHEN p.guest_club_id IS NOT NULL THEN c.name ELSE u.username END owner_username,
        CASE WHEN p.guest_club_id IS NOT NULL THEN 'guest' ELSE 'personal' END kind
      FROM club_profiles cp JOIN profiles p ON p.id=cp.profile_id JOIN users u ON u.id=p.owner_user_id JOIN clubs c ON c.id=cp.club_id
      WHERE cp.club_id=$1 AND p.deleted_at IS NULL
    ), filtered_participations AS (
      SELECT gp.*,g.state FROM games g JOIN game_participants gp ON gp.game_id=g.id
      WHERE g.club_id=$1 AND g.status='completed' AND g.deleted_at IS NULL AND ($2='all' OR ${gameModeKeySql}=$2)
    )
    SELECT cp.profile_id,cp.name,cp.avatar,cp.owner_username,cp.kind,COUNT(fp.game_id)::text games,
      COUNT(fp.game_id) FILTER(WHERE fp.is_winner)::text wins,COALESCE(SUM(fp.darts_thrown),0)::text darts,
      COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(fp.state->'turns','[]'::jsonb)) turn_data WHERE turn_data->>'playerId'=cp.profile_id)),0)::text turns,
      COALESCE(SUM(fp.points_scored),0)::text points,COALESCE(MAX(fp.best_turn),0) best_turn
    FROM club_players cp LEFT JOIN filtered_participations fp ON fp.profile_id=cp.profile_id
    GROUP BY cp.profile_id,cp.name,cp.avatar,cp.owner_username,cp.kind`, [params.data.clubId, query.data.mode]);
    const leaderboard: ClubStatisticRow[] = statsResult.rows.map((row) => {
      const games = Number(row.games); const wins = Number(row.wins); const darts = Number(row.darts); const turns = Number(row.turns); const points = Number(row.points);
      return { rank: 0, profileId: row.profile_id, name: row.name, ...(row.avatar ? { avatar: row.avatar } : {}), ownerUsername: row.owner_username, kind: row.kind, games, wins, losses: games - wins, winRate: games ? wins / games * 100 : 0, dartsThrown: darts, turnsPlayed: turns, pointsScored: points, averagePerDart: darts ? points / darts : 0, averagePerTurn: turns ? points / turns : 0, bestTurn: row.best_turn };
    }).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.averagePerDart - a.averagePerDart || b.games - a.games || a.name.localeCompare(b.name, "fr")).map((row, index) => ({ ...row, rank: index + 1 }));
    const response: ClubStatistics = { club: { id: club.id, name: club.name, ...(club.avatar ? { avatar: club.avatar } : {}) }, selectedMode: query.data.mode, modes, leaderboard };
    return response;
  });

  app.get("/:clubId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const [clubResult, messageResult] = await Promise.all([
      pool.query<{ id: string; name: string; avatar: string | null }>("SELECT id,name,avatar FROM clubs WHERE id=$1", [params.data.clubId]),
      pool.query<{ id: string; club_id: string; author_user_id: string | null; author_username: string; author_avatar: string | null; content: string; created_at: Date; edited_at: Date | null }>(`SELECT * FROM (SELECT cm.id,cm.club_id,cm.author_user_id,cm.author_username,u.avatar author_avatar,cm.content,cm.created_at,cm.edited_at
        FROM club_messages cm LEFT JOIN users u ON u.id=cm.author_user_id WHERE cm.club_id=$1 AND cm.deleted_at IS NULL ORDER BY cm.created_at DESC LIMIT 100) recent ORDER BY created_at`, [params.data.clubId]),
    ]);
    const club = clubResult.rows[0]; if (!club) return reply.code(404).send({ message: "Club introuvable." });
    const messages: ClubMessage[] = messageResult.rows.map((row) => ({ id: row.id, clubId: row.club_id, ...(row.author_user_id ? { authorUserId: row.author_user_id } : {}), authorUsername: row.author_username, content: row.content, createdAt: row.created_at.toISOString(), ...(row.edited_at ? { editedAt: row.edited_at.toISOString() } : {}), canModify: row.author_user_id === request.user.sub }));
    const authorAvatars = Object.fromEntries(messageResult.rows.flatMap((row) => row.author_user_id && row.author_avatar ? [[row.author_user_id, row.author_avatar]] : []));
    const response: ClubChat = { club: { id: club.id, name: club.name, ...(club.avatar ? { avatar: club.avatar } : {}) }, messages, authorAvatars };
    return response;
  });

  app.post("/:clubId/messages", { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = messageInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Le message doit contenir entre 1 et 1 000 caractères." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const id = randomUUID();
    const result = await pool.query("INSERT INTO club_messages(id,club_id,author_user_id,author_username,content) SELECT $1,$2,u.id,u.username,$3 FROM users u WHERE u.id=$4 RETURNING id", [id, params.data.clubId, body.data.content, request.user.sub]);
    return result.rowCount ? reply.code(201).send({ id }) : reply.code(404).send({ message: "Compte introuvable." });
  });

  app.delete("/:clubId/messages/:messageId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = messageParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ message: "Message invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const message = await pool.query<{ author_user_id: string | null }>("SELECT author_user_id FROM club_messages WHERE id=$1 AND club_id=$2 AND deleted_at IS NULL", [params.data.messageId, params.data.clubId]);
    const found = message.rows[0]; if (!found) return reply.code(404).send({ message: "Message introuvable." });
    if (found.author_user_id !== request.user.sub) return reply.code(403).send({ message: "Tu ne peux pas supprimer ce message." });
    await pool.query("UPDATE club_messages SET deleted_at=now() WHERE id=$1", [params.data.messageId]);
    return reply.code(204).send();
  });

  app.patch("/:clubId/messages/:messageId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = messageParams.safeParse(request.params); const body = messageInput.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ message: "Le message doit contenir entre 1 et 1 000 caractères." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const message = await pool.query<{ author_user_id: string | null }>("SELECT author_user_id FROM club_messages WHERE id=$1 AND club_id=$2 AND deleted_at IS NULL", [params.data.messageId, params.data.clubId]);
    const found = message.rows[0]; if (!found) return reply.code(404).send({ message: "Message introuvable." });
    if (found.author_user_id !== request.user.sub) return reply.code(403).send({ message: "Tu ne peux pas modifier ce message." });
    const updated = await pool.query<{ edited_at: Date }>("UPDATE club_messages SET content=$1,edited_at=now() WHERE id=$2 RETURNING edited_at", [body.data.content, params.data.messageId]);
    return { updated: true, editedAt: updated.rows[0]?.edited_at.toISOString() };
  });

  app.patch("/:clubId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = clubUpdateInput.safeParse(request.body); if (!params.success || !body.success) return reply.code(400).send({ message: "Modification invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return; if (!isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." });
    await pool.query("UPDATE clubs SET name=COALESCE($1,name),description=COALESCE($2,description),visibility=COALESCE($3,visibility),updated_at=now() WHERE id=$4", [body.data.name ?? null, body.data.description ?? null, body.data.visibility ?? null, params.data.clubId]);
    return { updated: true };
  });

  app.delete("/:clubId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Club invalide." });
    const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    if (access.role !== "owner") return reply.code(403).send({ message: "Seul le propriétaire peut supprimer le club." });
    await pool.query("DELETE FROM clubs WHERE id=$1 AND owner_user_id=$2", [parsed.data.clubId, request.user.sub]);
    return reply.code(204).send();
  });

  app.post("/:clubId/invite-code", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = clubParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Club invalide." }); const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return; if (!isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." });
    const next = code(); await pool.query("UPDATE clubs SET invite_code=$1,updated_at=now() WHERE id=$2", [next, parsed.data.clubId]); return { inviteCode: next };
  });

  app.post("/:clubId/members/:userId/approve", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = memberParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Membre invalide." }); const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return; if (!isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." });
    const result = await pool.query("UPDATE club_members SET status='active',joined_at=now(),left_at=NULL WHERE club_id=$1 AND user_id=$2 AND status='pending'", [parsed.data.clubId, parsed.data.userId]); return result.rowCount ? { status: "active" } : reply.code(404).send({ message: "Demande introuvable." });
  });

  app.patch("/:clubId/members/:userId", { preHandler: app.authenticate }, async (request, reply) => {
    const params = memberParams.safeParse(request.params); const body = z.object({ role: z.enum(["admin", "member"]) }).safeParse(request.body); if (!params.success || !body.success) return reply.code(400).send({ message: "Rôle invalide." });
    const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return; if (access.role !== "owner") return reply.code(403).send({ message: "Seul le propriétaire peut gérer les administrateurs." });
    await pool.query("UPDATE club_members SET role=$1 WHERE club_id=$2 AND user_id=$3 AND role<>'owner' AND status='active'", [body.data.role, params.data.clubId, params.data.userId]); return { updated: true };
  });

  app.delete("/:clubId/members/:userId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = memberParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Membre invalide." }); const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    const target = await membership(parsed.data.userId, parsed.data.clubId); if (!target || target.role === "owner") return reply.code(403).send({ message: "Le propriétaire ne peut pas quitter le club." });
    const self = parsed.data.userId === request.user.sub; if (!self && !isAdmin(access.role)) return reply.code(403).send({ message: "Droits administrateur requis." }); if (!self && target.role === "admin" && access.role !== "owner") return reply.code(403).send({ message: "Seul le propriétaire peut retirer un administrateur." });
    const client = await pool.connect(); try { await client.query("BEGIN"); await client.query("UPDATE club_members SET status='former',role='member',left_at=now() WHERE club_id=$1 AND user_id=$2", [parsed.data.clubId, parsed.data.userId]); await client.query(`DELETE FROM club_profiles cp USING profiles p WHERE cp.profile_id=p.id AND cp.club_id=$1 AND p.owner_user_id=$2 AND p.guest_club_id IS NULL`, [parsed.data.clubId, parsed.data.userId]); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return reply.code(204).send();
  });

  app.post("/:clubId/profiles/:profileId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = profileParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Profil invalide." }); const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    const profile = await pool.query("SELECT 1 FROM profiles WHERE id=$1 AND owner_user_id=$2 AND guest_club_id IS NULL AND deleted_at IS NULL", [parsed.data.profileId, request.user.sub]); if (!profile.rowCount) return reply.code(403).send({ message: "Tu peux partager uniquement tes propres profils." });
    await pool.query("INSERT INTO club_profiles(club_id,profile_id,shared_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [parsed.data.clubId, parsed.data.profileId, request.user.sub]); return reply.code(201).send({ shared: true });
  });

  app.delete("/:clubId/profiles/:profileId", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = profileParams.safeParse(request.params); if (!parsed.success) return reply.code(400).send({ message: "Profil invalide." }); const access = await requireActive(request.user.sub, parsed.data.clubId, reply); if (!access) return;
    const profile = await pool.query<{ owner_user_id: string; guest_club_id: string | null }>("SELECT owner_user_id,guest_club_id FROM profiles WHERE id=$1", [parsed.data.profileId]); const found = profile.rows[0]; if (!found || (found.owner_user_id !== request.user.sub && !isAdmin(access.role))) return reply.code(403).send({ message: "Tu ne peux pas retirer ce profil." });
    if (found.guest_club_id === parsed.data.clubId) { await pool.query("UPDATE profiles SET deleted_at=now(),updated_at=now() WHERE id=$1", [parsed.data.profileId]); }
    else await pool.query("DELETE FROM club_profiles WHERE club_id=$1 AND profile_id=$2", [parsed.data.clubId, parsed.data.profileId]);
    return reply.code(204).send();
  });

  app.post("/:clubId/guest-profiles", { preHandler: app.authenticate }, async (request, reply) => {
    const params = clubParams.safeParse(request.params); const body = guestInput.safeParse(request.body); if (!params.success || !body.success) return reply.code(400).send({ message: "Profil invité invalide." }); const access = await requireActive(request.user.sub, params.data.clubId, reply); if (!access) return;
    const duplicate = await pool.query("SELECT 1 FROM club_profiles cp JOIN profiles p ON p.id=cp.profile_id WHERE cp.club_id=$1 AND p.deleted_at IS NULL AND lower(p.name)=lower($2)", [params.data.clubId, body.data.name]); if (duplicate.rowCount) return reply.code(409).send({ message: "Un profil portant ce nom existe déjà dans le club." });
    const id = randomUUID(); const normalized = `g:${params.data.clubId.slice(0, 6)}:${normalizeName(body.data.name)}`;
    const client = await pool.connect(); try { await client.query("BEGIN"); await client.query("INSERT INTO profiles(id,owner_user_id,name,normalized_name,color,guest_club_id) VALUES($1,$2,$3,$4,$5,$6)", [id, request.user.sub, body.data.name.trim().replace(/\s+/g, " "), normalized, body.data.color ?? null, params.data.clubId]); await client.query("INSERT INTO club_profiles(club_id,profile_id,shared_by) VALUES($1,$2,$3)", [params.data.clubId, id, request.user.sub]); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return reply.code(201).send({ id });
  });
};

export default clubRoutes;
