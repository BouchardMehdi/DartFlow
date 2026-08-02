import { database } from "@/src/database/database";
import { gameStateSchema } from "@/src/database/schemas";
import type { GameState } from "@/src/game-engine/types";

export async function saveGame(state: GameState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await database.games.put({ ...structuredClone(state), savedAt: new Date().toISOString() });
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
  await database.games.delete(id);
}
