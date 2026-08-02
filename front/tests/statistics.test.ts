import { describe, expect, it } from "vitest";
import { createCountUpGame, registerThrow } from "@/src/game-engine/count-up";
import { getFinalStandings } from "@/src/game-engine/statistics";
import type { DartThrow, Player } from "@/src/game-engine/types";

const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (score: number): DartThrow => ({ id: crypto.randomUUID(), segment: score, multiplier: 1, score, zone: "single-inner", thrownAt: new Date().toISOString() });

describe("statistiques finales", () => {
  it("classe les joueurs et calcule leurs statistiques", () => {
    let game = createCountUpGame(players, 1);
    for (const score of [20, 20, 20, 10, 10, 10]) game = registerThrow(game, dart(score)).state;
    const standings = getFinalStandings(game);
    expect(standings[0]).toMatchObject({ playerId: "p1", rank: 1, score: 60, dartsThrown: 3, bestTurn: 60, averagePerTurn: 60, averagePerDart: 20, isWinner: true });
    expect(standings[1]).toMatchObject({ playerId: "p2", rank: 2, score: 30 });
  });
});
