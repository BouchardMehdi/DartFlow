import { database } from "@/src/database/database";
import { gameStateSchema } from "@/src/database/schemas";
import type { GameState } from "@/src/game-engine/types";
import { notifyCloudDataChanged } from "@/src/cloud/events";

export async function saveGame(state: GameState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const existing = await database.games.get(state.id);
  await database.games.put({ ...structuredClone(state), savedAt: new Date().toISOString(), ...(existing?.cloudUserId ? { cloudUserId: existing.cloudUserId } : {}), ...(existing?.cloudOwnerUserId ? { cloudOwnerUserId: existing.cloudOwnerUserId } : {}), ...(existing?.cloudVersion === undefined ? {} : { cloudVersion: existing.cloudVersion }) });
  notifyCloudDataChanged();
}

export async function loadResumableGame(): Promise<GameState | null> {
  if (typeof indexedDB === "undefined") return null;
  const [allGames, metadata] = await Promise.all([database.games.orderBy("createdAt").reverse().toArray(), database.syncMetadata.get("main")]);
  const games = allGames.filter((game) => !game.cloudUserId || game.cloudUserId === metadata?.activeUserId);
  const latest = games.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  if (!latest || (latest.status !== "in-progress" && latest.status !== "paused")) return null;
  const parsed = gameStateSchema.safeParse(latest);
  return parsed.success ? parsed.data as GameState : null;
}

export async function deleteSavedGame(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await database.transaction("rw", database.games, database.syncOutbox, async () => {
    await database.games.delete(id);
    await database.syncOutbox.put({ id: crypto.randomUUID(), entityType: "game", entityId: id, action: "delete", createdAt: new Date().toISOString() });
  });
  notifyCloudDataChanged();
}

export async function loadAllGames(): Promise<GameState[]> {
  if (typeof indexedDB === "undefined") return [];
  const [allGames, metadata] = await Promise.all([database.games.toArray(), database.syncMetadata.get("main")]);
  const games = allGames.filter((game) => !game.cloudUserId || game.cloudUserId === metadata?.activeUserId);
  return games.flatMap((game) => { const parsed = gameStateSchema.safeParse(game); return parsed.success ? [parsed.data as GameState] : []; });
}

export async function loadCompletedGames(): Promise<GameState[]> {
  if (typeof indexedDB === "undefined") return [];
  const [allSaved, metadata] = await Promise.all([database.games.where("status").equals("completed").reverse().sortBy("completedAt"), database.syncMetadata.get("main")]);
  const saved = allSaved.filter((game) => !game.cloudUserId || game.cloudUserId === metadata?.activeUserId);
  return saved.flatMap((game) => { const parsed = gameStateSchema.safeParse(game); return parsed.success ? [parsed.data as GameState] : []; }).reverse();
}
