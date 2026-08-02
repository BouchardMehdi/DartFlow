import { database } from "@/src/database/database";
import { gameStateSchema } from "@/src/database/schemas";
import type { GameState } from "@/src/game-engine/types";
import { notifyCloudDataChanged } from "@/src/cloud/events";

export async function saveGame(state: GameState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const existing = await database.games.get(state.id);
  await database.games.put({ ...structuredClone(state), savedAt: new Date().toISOString(), ...(existing?.cloudUserId ? { cloudUserId: existing.cloudUserId } : {}), ...(existing?.cloudVersion === undefined ? {} : { cloudVersion: existing.cloudVersion }) });
  notifyCloudDataChanged();
}

export async function loadResumableGame(): Promise<GameState | null> {
  if (typeof indexedDB === "undefined") return null;
  const games = await database.games.orderBy("createdAt").reverse().toArray();
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
  const games = await database.games.toArray();
  return games.flatMap((game) => { const parsed = gameStateSchema.safeParse(game); return parsed.success ? [parsed.data as GameState] : []; });
}

export async function loadCompletedGames(): Promise<GameState[]> {
  if (typeof indexedDB === "undefined") return [];
  const saved = await database.games.where("status").equals("completed").reverse().sortBy("completedAt");
  return saved.flatMap((game) => { const parsed = gameStateSchema.safeParse(game); return parsed.success ? [parsed.data as GameState] : []; }).reverse();
}
