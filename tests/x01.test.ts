import { describe, expect, it } from "vitest";
import { createX01Game, registerX01Throw } from "@/src/game-engine/x01";
import type { DartThrow, GameState, Player } from "@/src/game-engine/types";

const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (segment: number, multiplier: 1 | 2 | 3): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 2 ? "double" : multiplier === 3 ? "triple" : "single-inner", thrownAt: new Date().toISOString() });
const withScore = (state: GameState, score: number): GameState => {
  if (state.modeState.kind !== "x01") throw new Error();
  return { ...state, currentTurn: { ...state.currentTurn, scoreBeforeTurn: score, scoreAfterTurn: score }, modeState: { ...state.modeState, players: { ...state.modeState.players, p1: { score, hasEntered: true } } } };
};

describe("X01", () => {
  it.each([301, 501, 701] as const)("initialise une partie en %i", (score) => {
    const state = createX01Game(players, score, "straight", "double");
    expect(state.modeState.kind === "x01" && state.modeState.players.p1?.score).toBe(score);
  });
  it("exige un double pour entrer en double-in", () => {
    let state = createX01Game(players, 301, "double", "double");
    state = registerX01Throw(state, dart(20, 1)).state;
    expect(state.currentTurn.scoreAfterTurn).toBe(301);
    state = registerX01Throw(state, dart(20, 2)).state;
    expect(state.currentTurn.scoreAfterTurn).toBe(261);
  });
  it("restaure le score du début de tour après un bust", () => {
    const state = registerX01Throw(withScore(createX01Game(players, 301, "straight", "double"), 20), dart(20, 1)).state;
    expect(state.modeState.kind === "x01" && state.modeState.players.p1?.score).toBe(20);
    expect(state.turns.at(-1)?.isBust).toBe(true);
  });
  it("refuse une sortie simple en double-out", () => {
    const state = registerX01Throw(withScore(createX01Game(players, 301, "straight", "double"), 20), dart(20, 1)).state;
    expect(state.status).toBe("in-progress");
  });
  it("termine sur un double valide", () => {
    const state = registerX01Throw(withScore(createX01Game(players, 301, "straight", "double"), 40), dart(20, 2)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
  it("termine à la limite de manches avec le plus petit score restant", () => {
    let state = createX01Game(players, 301, "straight", "double", 1);
    for (let index = 0; index < 3; index += 1) state = registerX01Throw(state, dart(20, 1)).state;
    for (let index = 0; index < 3; index += 1) state = registerX01Throw(state, dart(10, 1)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
  it("continue sans limite lorsque le nombre de manches est infini", () => {
    let state = createX01Game([players[0]!], 301, "straight", "double", null);
    for (let index = 0; index < 3; index += 1) state = registerX01Throw(state, dart(20, 1)).state;
    expect(state.status).toBe("in-progress"); expect(state.currentRound).toBe(2);
  });
});
