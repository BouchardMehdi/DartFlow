import { describe, expect, it } from "vitest";
import type { SavedPlayer } from "@/src/database/database";
import { buildProfileStatistics } from "@/src/statistics/profile-statistics";
import { createX01Game } from "@/src/game-engine/x01";
import type { GameState } from "@/src/game-engine/types";

describe("buildProfileStatistics", () => {
  it("regroupe les statistiques d'un profil par mode", () => {
    const profile: SavedPlayer = { id: "p1", name: "Alice", order: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const dart = { id: "d1", segment: 20, multiplier: 3 as const, score: 60, zone: "triple" as const, thrownAt: "2026-01-01T00:00:00.000Z" };
    const turn = { id: "t1", playerId: "p1", roundNumber: 1, darts: [dart], scoreBeforeTurn: 0, scoreAfterTurn: 60, turnScore: 60, isBust: false, isCompleted: true, createdAt: dart.thrownAt };
    const game = { id: "g1", modeId: "count-up", status: "completed", players: [{ id: "p1", name: "Alice", order: 0 }], currentPlayerIndex: 0, currentRound: 1, currentTurn: turn, turns: [turn], modeState: { kind: "count-up", maxRounds: 1, scores: { p1: 60 } }, winnerId: "p1", createdAt: dart.thrownAt, updatedAt: dart.thrownAt, completedAt: dart.thrownAt } satisfies GameState;
    const result = buildProfileStatistics([profile], [game]);
    expect(result[0]?.totals).toMatchObject({ games: 1, wins: 1, dartsThrown: 1, bestTurn: 60, averagePerDart: 60 });
    expect(result[0]?.modes[0]?.label).toBe("Count-Up");
  });

  it("sépare les statistiques 301, 501 et 701", () => {
    const profile: SavedPlayer = { id: "p1", name: "Alice", order: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const games = ([301, 501, 701] as const).map((score) => {
      const game = createX01Game([{ id: "p1", name: "Alice", order: 0 }], score, "straight", "double");
      return { ...game, status: "completed" as const, winnerId: "p1", completedAt: game.updatedAt };
    });

    const result = buildProfileStatistics([profile], games);

    expect(result[0]?.modes.map(({ key, label, games: count }) => ({ key, label, count }))).toEqual([
      { key: "x01-301", label: "301", count: 1 },
      { key: "x01-501", label: "501", count: 1 },
      { key: "x01-701", label: "701", count: 1 },
    ]);
  });
});
