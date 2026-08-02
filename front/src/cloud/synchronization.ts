import type { AccountUser, SyncRequest, SyncResponse } from "@dartflow/shared";
import { database, type SavedGame, type SavedPlayer } from "@/src/database/database";
import { gameStateSchema } from "@/src/database/schemas";
import { apiRequest } from "./api";

const remap = (value: unknown, mappings: Record<string, string>): unknown => {
  if (typeof value === "string") return mappings[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => remap(item, mappings));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [mappings[key] ?? key, remap(item, mappings)]));
};

let activeSync: Promise<string> | null = null;

export function synchronizeCloud(user: AccountUser): Promise<string> {
  if (activeSync) return activeSync;
  activeSync = runSynchronization(user).finally(() => { activeSync = null; });
  return activeSync;
}

async function runSynchronization(user: AccountUser): Promise<string> {
  const [profiles, games, outbox] = await Promise.all([database.players.toArray(), database.games.toArray(), database.syncOutbox.toArray()]);
  const request: SyncRequest = {
    profiles: profiles.filter((profile) => (!profile.cloudUserId || profile.cloudUserId === user.id) && (!profile.cloudRole || profile.cloudRole === "owner")).map((profile) => ({ id: profile.id, name: profile.name, ...(profile.color ? { color: profile.color } : {}), ...(profile.avatar ? { avatar: profile.avatar } : {}), updatedAt: profile.updatedAt })),
    games: games.filter((game) => !game.cloudOwnerUserId || game.cloudOwnerUserId === user.id).map((game) => ({ id: game.id, modeId: game.modeId, status: game.status, state: game, updatedAt: game.updatedAt })),
    deletedGameIds: outbox.filter((item) => item.entityType === "game" && item.action === "delete").map((item) => item.entityId),
  };
  try {
    const response = await apiRequest<SyncResponse>("/sync", { method: "POST", body: JSON.stringify(request) });
    const now = response.syncedAt;
    await database.transaction("rw", database.players, database.games, database.syncOutbox, database.syncMetadata, async () => {
      const accessibleProfileIds = new Set(response.profiles.map((profile) => profile.id));
      const accessibleGameIds = new Set(response.games.map((game) => game.id));
      const cachedProfiles = await database.players.toArray();
      const cachedGames = await database.games.toArray();
      await database.players.bulkDelete(cachedProfiles.filter((profile) => profile.cloudUserId === user.id && profile.cloudRole && profile.cloudRole !== "owner" && !accessibleProfileIds.has(profile.id)).map((profile) => profile.id));
      await database.games.bulkDelete(cachedGames.filter((game) => game.cloudUserId === user.id && game.cloudOwnerUserId && game.cloudOwnerUserId !== user.id && !accessibleGameIds.has(game.id)).map((game) => game.id));
      for (const [oldId, newId] of Object.entries(response.profileIdMappings)) {
        const oldProfile = await database.players.get(oldId);
        if (oldProfile) { await database.players.delete(oldId); await database.players.put({ ...oldProfile, id: newId, cloudUserId: user.id }); }
        const affectedGames = await database.games.toArray();
        for (const game of affectedGames) {
          const parsed = gameStateSchema.safeParse(remap(game, { [oldId]: newId }));
          if (parsed.success) await database.games.put({ ...parsed.data, savedAt: game.savedAt, cloudUserId: game.cloudUserId ?? user.id, cloudOwnerUserId: game.cloudOwnerUserId ?? user.id, ...(game.cloudVersion === undefined ? {} : { cloudVersion: game.cloudVersion }) } as SavedGame);
        }
      }
      for (const profile of response.profiles) {
        const local = await database.players.get(profile.id);
        const saved: SavedPlayer = { id: profile.id, name: profile.name, order: local?.order ?? 0, createdAt: profile.createdAt, updatedAt: profile.updatedAt, cloudUserId: user.id, cloudRole: profile.role, ownerUserId: profile.ownerUserId, ownerUsername: profile.ownerUsername, isPublic: profile.isPublic, ...(profile.color ? { color: profile.color } : {}), ...(profile.avatar ? { avatar: profile.avatar } : {}) };
        await database.players.put(saved);
      }
      for (const cloudGame of response.games) {
        const parsed = gameStateSchema.safeParse(cloudGame.state);
        if (parsed.success) await database.games.put({ ...parsed.data, savedAt: cloudGame.updatedAt, cloudUserId: user.id, cloudOwnerUserId: cloudGame.ownerUserId, cloudVersion: cloudGame.version } as SavedGame);
      }
      await database.syncOutbox.clear();
      await database.syncMetadata.put({ id: "main", activeUserId: user.id, lastSyncedAt: now });
    });
    return now;
  } catch (error) {
    await database.syncMetadata.put({ id: "main", activeUserId: user.id, lastError: error instanceof Error ? error.message : "Synchronisation impossible." });
    throw error;
  }
}
