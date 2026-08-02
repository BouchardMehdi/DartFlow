import { database, type SavedPlayer } from "@/src/database/database";
import type { Player } from "@/src/game-engine/types";
import { notifyCloudDataChanged } from "@/src/cloud/events";

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

export function deduplicatePlayerProfiles(players: SavedPlayer[]): SavedPlayer[] {
  const seen = new Set<string>();
  return [...players].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((player) => {
    const identity = player.ownerUserId ? `${player.ownerUserId}:${normalizePlayerName(player.name)}` : `local:${normalizePlayerName(player.name)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function savePlayers(players: Player[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const now = new Date().toISOString();
  const [saved, metadata] = await Promise.all([database.players.toArray(), database.syncMetadata.get("main")]);
  const byId = new Map(saved.map((player) => [player.id, player]));
  const byName = new Map(deduplicatePlayerProfiles(saved).filter((player) => !player.cloudRole || player.cloudRole === "owner").map((player) => [normalizePlayerName(player.name), player]));
  const records = new Map<string, SavedPlayer>();
  for (const player of players) {
    const name = player.name.trim().replace(/\s+/g, " ");
    const existing = byId.get(player.id) ?? byName.get(normalizePlayerName(name));
    const base = { id: existing?.id ?? player.id, name: existing?.name ?? name, order: player.order, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const clubOnly = player.clubProfile && existing?.cloudRole !== "owner";
    const cloudUserId = existing?.cloudUserId ?? (clubOnly ? metadata?.activeUserId : undefined);
    const record: SavedPlayer = { ...base, ...(existing?.color || player.color ? { color: existing?.color ?? player.color } : {}), ...(existing?.avatar || player.avatar ? { avatar: existing?.avatar ?? player.avatar } : {}), ...(cloudUserId ? { cloudUserId } : {}), ...(existing?.cloudRole || clubOnly ? { cloudRole: existing?.cloudRole ?? "player" } : {}), ...(existing?.ownerUserId || player.ownerUserId ? { ownerUserId: existing?.ownerUserId ?? player.ownerUserId } : {}), ...(existing?.ownerUsername || player.ownerUsername ? { ownerUsername: existing?.ownerUsername ?? player.ownerUsername } : {}), ...(player.clubProfile ? { clubProfile: true } : {}), ...(existing?.isPublic === undefined ? {} : { isPublic: existing.isPublic }) };
    records.set(record.id, record);
  }
  await database.players.bulkPut([...records.values()]);
  notifyCloudDataChanged();
}

export async function loadPlayers(): Promise<SavedPlayer[]> {
  if (typeof indexedDB === "undefined") return [];
  const [players, metadata] = await Promise.all([database.players.toArray(), database.syncMetadata.get("main")]);
  return deduplicatePlayerProfiles(players.filter((player) => !player.cloudUserId || player.cloudUserId === metadata?.activeUserId));
}
