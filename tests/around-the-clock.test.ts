import { describe, expect, it } from "vitest";
import { createAroundTheClockGame, registerAroundTheClockThrow } from "@/src/game-engine/around-the-clock";
import type { DartThrow, GameState, Player } from "@/src/game-engine/types";

const players = (count = 2): Player[] => Array.from({ length: count }, (_, order) => ({ id: `p${order}`, name: `Joueur ${order + 1}`, order }));
const dart = (segment: number, multiplier: 1 | 2 | 3 = 1): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", thrownAt: new Date().toISOString() });
const bull = (): DartThrow => ({ id: crypto.randomUUID(), segment: null, multiplier: 2, score: 50, zone: "inner-bull", thrownAt: new Date().toISOString() });
const target = (state: GameState, id = "p0") => state.modeState.kind === "around-the-clock" ? state.modeState.players[id]?.target : undefined;

describe("Around the Clock", () => {
  it("avance uniquement avec un simple dans la variante simple obligatoire", () => {
    let state = createAroundTheClockGame(players(), "single-only", false, null);
    state = registerAroundTheClockThrow(state, dart(1, 2)).state; expect(target(state)).toBe(1);
    state = registerAroundTheClockThrow(state, dart(1)).state; expect(target(state)).toBe(2);
  });
  it("fait avancer les doubles et triples de deux ou trois secteurs", () => {
    let state = createAroundTheClockGame(players(), "multiplier", false, null);
    state = registerAroundTheClockThrow(state, dart(1, 2)).state; expect(target(state)).toBe(3);
    state = registerAroundTheClockThrow(state, dart(3, 3)).state; expect(target(state)).toBe(6);
  });
  it("change de joueur après trois fléchettes", () => {
    let state = createAroundTheClockGame(players(), "multiplier", false, null);
    for (let index = 0; index < 3; index += 1) state = registerAroundTheClockThrow(state, dart(20)).state;
    expect(state.currentPlayerIndex).toBe(1);
  });
  it("exige le bull lorsque l'option est active", () => {
    let state = createAroundTheClockGame(players(1), "multiplier", true, null);
    if (state.modeState.kind !== "around-the-clock") throw new Error();
    state = { ...state, currentTurn: { ...state.currentTurn, scoreBeforeTurn: 20, scoreAfterTurn: 20 }, modeState: { ...state.modeState, players: { p0: { target: 20, completed: false } } } };
    state = registerAroundTheClockThrow(state, dart(20, 3)).state; expect(target(state)).toBe(21); expect(state.status).toBe("in-progress");
    state = registerAroundTheClockThrow(state, bull()).state; expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p0");
  });
  it("termine directement au secteur 20 sans bull final", () => {
    let state = createAroundTheClockGame(players(1), "single-only", false, null);
    if (state.modeState.kind !== "around-the-clock") throw new Error();
    state = { ...state, currentTurn: { ...state.currentTurn, scoreBeforeTurn: 20, scoreAfterTurn: 20 }, modeState: { ...state.modeState, players: { p0: { target: 20, completed: false } } } };
    state = registerAroundTheClockThrow(state, dart(20)).state; expect(state.status).toBe("completed");
  });
  it("désigne le joueur le plus avancé à la limite des manches", () => {
    let state = createAroundTheClockGame(players(), "multiplier", false, 1);
    state = registerAroundTheClockThrow(state, dart(1, 3)).state; state = registerAroundTheClockThrow(state, dart(4)).state; state = registerAroundTheClockThrow(state, dart(20)).state;
    for (let index = 0; index < 3; index += 1) state = registerAroundTheClockThrow(state, dart(20)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p0");
  });
});
