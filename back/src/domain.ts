import type { LeaderboardRow } from "@dartflow/shared";

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
export const normalizeEmail = (email: string) => email.trim().toLocaleLowerCase("en-US");
export const normalizeUsername = (username: string) => username.trim().toLocaleLowerCase("en-US");

type JsonRecord = Record<string, unknown>;

export function remapIdentifiers(value: unknown, mappings: Record<string, string>): unknown {
  if (typeof value === "string") return mappings[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => remapIdentifiers(item, mappings));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [mappings[key] ?? key, remapIdentifiers(item, mappings)]));
}

export interface PublicProfileRow { id: string; name: string; ownerUsername?: string }
export interface LeaderboardGameRow { mode_id: string; state: unknown }

export function buildLeaderboard(profiles: PublicProfileRow[], games: LeaderboardGameRow[]): LeaderboardRow[] {
  const rows = profiles.map((profile) => {
    let played = 0; let wins = 0; let dartsThrown = 0; let scored = 0; let bestTurn = 0;
    for (const game of games) {
      const state = game.state as { players?: Array<{ id?: string }>; winnerId?: string; turns?: Array<{ playerId?: string; darts?: unknown[]; turnScore?: number }> };
      if (!state.players?.some((player) => player.id === profile.id)) continue;
      played += 1;
      if (state.winnerId === profile.id) wins += 1;
      for (const turn of state.turns ?? []) {
        if (turn.playerId !== profile.id) continue;
        const dartCount = turn.darts?.length ?? 0;
        const turnScore = typeof turn.turnScore === "number" ? turn.turnScore : 0;
        dartsThrown += dartCount; scored += turnScore; bestTurn = Math.max(bestTurn, turnScore);
      }
    }
    return { rank: 0, profileId: profile.id, name: profile.name, ownerUsername: profile.ownerUsername ?? "joueur", games: played, wins, winRate: played ? wins / played * 100 : 0, dartsThrown, averagePerDart: dartsThrown ? scored / dartsThrown : 0, bestTurn };
  }).filter((row) => row.games > 0).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.averagePerDart - a.averagePerDart || b.games - a.games);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface ParticipantMetrics { profileId: string; name: string; dartsThrown: number; pointsScored: number; bestTurn: number; isWinner: boolean }

export function extractParticipants(state: unknown): ParticipantMetrics[] {
  const game = state as { players?: Array<{ id?: string; name?: string }>; turns?: Array<{ playerId?: string; darts?: unknown[]; turnScore?: number }>; winnerId?: string };
  return (game.players ?? []).flatMap((player) => {
    if (!player.id || !player.name) return [];
    const turns = (game.turns ?? []).filter((turn) => turn.playerId === player.id);
    return [{ profileId: player.id, name: player.name, dartsThrown: turns.reduce((sum, turn) => sum + (turn.darts?.length ?? 0), 0), pointsScored: turns.reduce((sum, turn) => sum + (typeof turn.turnScore === "number" ? turn.turnScore : 0), 0), bestTurn: turns.reduce((best, turn) => Math.max(best, typeof turn.turnScore === "number" ? turn.turnScore : 0), 0), isWinner: game.winnerId === player.id }];
  });
}
