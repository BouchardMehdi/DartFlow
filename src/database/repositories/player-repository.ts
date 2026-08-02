import { database, type SavedPlayer } from "@/src/database/database";
import type { Player } from "@/src/game-engine/types";

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

export function deduplicatePlayerProfiles(players: SavedPlayer[]): SavedPlayer[] {
  const seen = new Set<string>();
  return [...players].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((player) => {
    const normalizedName = normalizePlayerName(player.name);
    if (seen.has(normalizedName)) return false;
    seen.add(normalizedName);
    return true;
  });
}

export async function savePlayers(players: Player[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const now = new Date().toISOString();
  const saved = await database.players.toArray();
  const byId = new Map(saved.map((player) => [player.id, player]));
  const byName = new Map(deduplicatePlayerProfiles(saved).map((player) => [normalizePlayerName(player.name), player]));
  const records = new Map<string, SavedPlayer>();
  for (const player of players) {
    const name = player.name.trim().replace(/\s+/g, " ");
    const existing = byName.get(normalizePlayerName(name)) ?? byId.get(player.id);
    const base = { id: existing?.id ?? player.id, name: existing?.name ?? name, order: player.order, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const record: SavedPlayer = { ...base, ...(existing?.color || player.color ? { color: existing?.color ?? player.color } : {}), ...(existing?.avatar || player.avatar ? { avatar: existing?.avatar ?? player.avatar } : {}) };
    records.set(record.id, record);
  }
  await database.players.bulkPut([...records.values()]);
}

export async function loadPlayers(): Promise<SavedPlayer[]> {
  if (typeof indexedDB === "undefined") return [];
  return deduplicatePlayerProfiles(await database.players.toArray());
}
