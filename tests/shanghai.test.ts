import { describe, expect, it } from "vitest";
import { createShanghaiGame, registerShanghaiThrow } from "@/src/game-engine/shanghai";
import type { DartThrow, Player } from "@/src/game-engine/types";

const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (segment: number, multiplier: 1 | 2 | 3): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", thrownAt: new Date().toISOString() });

describe("Shanghai", () => {
  it("ne compte que les impacts sur le numéro de la manche", () => {
    let state = createShanghaiGame(players, 7, true);
    state = registerShanghaiThrow(state, dart(20, 3)).state; state = registerShanghaiThrow(state, dart(1, 2)).state;
    expect(state.modeState.kind === "shanghai" && state.modeState.scores.p1).toBe(2);
  });
  it("cumule simple, double et triple du numéro actif", () => {
    let state = createShanghaiGame(players, 7, false);
    state = registerShanghaiThrow(state, dart(1, 1)).state; state = registerShanghaiThrow(state, dart(1, 2)).state; state = registerShanghaiThrow(state, dart(1, 3)).state;
    expect(state.modeState.kind === "shanghai" && state.modeState.scores.p1).toBe(6);
    expect(state.turns[0]?.turnScore).toBe(6);
  });
  it("déclenche une victoire immédiate sur un Shanghai si configuré", () => {
    let state = createShanghaiGame(players, 7, true);
    state = registerShanghaiThrow(state, dart(1, 1)).state; state = registerShanghaiThrow(state, dart(1, 2)).state; state = registerShanghaiThrow(state, dart(1, 3)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
  it("continue sans victoire immédiate lorsque l'option est désactivée", () => {
    let state = createShanghaiGame(players, 7, false);
    state = registerShanghaiThrow(state, dart(1, 1)).state; state = registerShanghaiThrow(state, dart(1, 2)).state; state = registerShanghaiThrow(state, dart(1, 3)).state;
    expect(state.status).toBe("in-progress"); expect(state.currentPlayerIndex).toBe(1);
  });
  it("termine après la dernière manche et classe au score", () => {
    let state = createShanghaiGame(players, 1, false);
    for (const multiplier of [1, 1, 1] as const) state = registerShanghaiThrow(state, dart(1, multiplier)).state;
    for (let index = 0; index < 3; index += 1) state = registerShanghaiThrow(state, dart(20, 1)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
  it("refuse plus de vingt manches", () => { expect(() => createShanghaiGame(players, 21, true)).toThrow(); });
  it("permet de choisir le premier secteur", () => {
    let state = createShanghaiGame(players, 7, false, 5); expect(state.currentRound).toBe(5);
    state = registerShanghaiThrow(state, dart(5, 2)).state; expect(state.modeState.kind === "shanghai" && state.modeState.scores.p1).toBe(10);
  });
});
