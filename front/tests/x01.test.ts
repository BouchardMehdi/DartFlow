import { describe, expect, it } from "vitest";
import { createX01Game, registerX01Throw } from "@/src/game-engine/x01";
import type { DartThrow, GameState, Player } from "@/src/game-engine/types";
import { gameStateSchema } from "@/src/database/schemas";

const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (segment: number, multiplier: 1 | 2 | 3): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 2 ? "double" : multiplier === 3 ? "triple" : "single-inner", thrownAt: new Date().toISOString() });
const withScore = (state: GameState, score: number): GameState => {
  if (state.modeState.kind !== "x01") throw new Error();
  const playerState = state.modeState.players.p1; if (!playerState) throw new Error();
  return { ...state, currentTurn: { ...state.currentTurn, scoreBeforeTurn: score, scoreAfterTurn: score }, modeState: { ...state.modeState, players: { ...state.modeState.players, p1: { ...playerState, score, hasEntered: true } } } };
};

describe("X01", () => {
  it.each([901, 1101, 1501] as const)("sauvegarde et reprend une partie en %i après un lancer", score => {
    const game = registerX01Throw(createX01Game(players, score, "straight", "double"), dart(20, 3)).state;
    const restored = gameStateSchema.parse(JSON.parse(JSON.stringify(game))) as GameState;
    expect(restored.modeState).toMatchObject({ startingScore: score, players: { p1: { score: score - 60 }, p2: { score } } });
    expect(restored.currentTurn.scoreBeforeTurn).toBe(score);
    expect(registerX01Throw(restored, dart(20, 2)).state.currentTurn.scoreAfterTurn).toBe(score - 100);
  });
  it.each([901, 1101, 1501] as const)("repart du bon score au leg suivant en %i", score => {
    const game = createX01Game(players, score, "straight", "double", null, 2, 1);
    const next = registerX01Throw(withScore(game, 40), dart(20, 2)).state;
    expect(next.status).toBe("in-progress");
    expect(next.modeState).toMatchObject({ startingScore: score, players: { p1: { score, legsWon: 1 }, p2: { score } } });
    expect(next.currentTurn.scoreBeforeTurn).toBe(score);
  });
  it.each([301, 501, 701, 901, 1101, 1501] as const)("initialise une partie en %i", (score) => {
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
  it("enchaîne les legs et les sets avant de terminer le match", () => {
    let state = createX01Game([players[0]!], 301, "straight", "double", null, 2, 2);
    state = registerX01Throw(withScore(state, 40), dart(20, 2)).state;
    expect(state.status).toBe("in-progress"); expect(state.modeState.kind === "x01" && state.modeState.players.p1?.legsWon).toBe(1);
    state = registerX01Throw(withScore(state, 40), dart(20, 2)).state;
    expect(state.modeState.kind === "x01" && state.modeState.players.p1?.setsWon).toBe(1);
    state = registerX01Throw(withScore(state, 40), dart(20, 2)).state;
    state = registerX01Throw(withScore(state, 40), dart(20, 2)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
    expect(state.modeState.kind === "x01" && state.modeState.players.p1?.setsWon).toBe(2);
  });
});
