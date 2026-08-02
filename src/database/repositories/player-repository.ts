import { database, type SavedPlayer } from "@/src/database/database";
import type { Player } from "@/src/game-engine/types";

export async function savePlayers(players: Player[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const now = new Date().toISOString();
  const existing = new Map((await database.players.bulkGet(players.map((player) => player.id))).filter((player): player is SavedPlayer => player !== undefined).map((player) => [player.id, player]));
  await database.players.bulkPut(players.map((player) => ({ ...player, createdAt: existing.get(player.id)?.createdAt ?? now, updatedAt: now })));
}

export async function loadPlayers(): Promise<SavedPlayer[]> {
  if (typeof indexedDB === "undefined") return [];
  return database.players.orderBy("updatedAt").reverse().toArray();
}
