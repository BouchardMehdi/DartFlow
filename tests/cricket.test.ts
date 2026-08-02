import { describe, expect, it } from "vitest";
import { createCricketGame, registerCricketThrow } from "@/src/game-engine/cricket";
import type { CricketTarget, DartThrow, GameState, Player } from "@/src/game-engine/types";

const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (segment: number, multiplier: 1 | 2 | 3): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", thrownAt: new Date().toISOString() });
const bull = (inner = false): DartThrow => ({ id: crypto.randomUUID(), segment: null, multiplier: inner ? 2 : 1, score: inner ? 50 : 25, zone: inner ? "inner-bull" : "outer-bull", thrownAt: new Date().toISOString() });
const setMarks = (state: GameState, playerId: string, target: CricketTarget, marks: number, score?: number): GameState => {
  if (state.modeState.kind !== "cricket") throw new Error(); const current = state.modeState.players[playerId]; if (!current) throw new Error();
  return { ...state, currentTurn: playerId === state.currentTurn.playerId && score !== undefined ? { ...state.currentTurn, scoreBeforeTurn: score, scoreAfterTurn: score } : state.currentTurn, modeState: { ...state.modeState, players: { ...state.modeState.players, [playerId]: { ...current, ...(score === undefined ? {} : { score }), marks: { ...current.marks, [target]: marks } } } } };
};

describe("Cricket standard", () => {
  it("enregistre une, deux et trois marques", () => {
    let state = createCricketGame(players, null); state = registerCricketThrow(state, dart(20, 1)).state; state = registerCricketThrow(state, dart(19, 2)).state; state = registerCricketThrow(state, dart(18, 3)).state;
    if (state.modeState.kind !== "cricket") throw new Error(); expect(state.modeState.players.p1?.marks[20]).toBe(1); expect(state.modeState.players.p1?.marks[19]).toBe(2); expect(state.modeState.players.p1?.marks[18]).toBe(3);
  });
  it("transforme les marques excédentaires en points si un adversaire reste ouvert", () => {
    let state = setMarks(createCricketGame(players, null), "p1", 20, 2); state = registerCricketThrow(state, dart(20, 3)).state;
    expect(state.modeState.kind === "cricket" && state.modeState.players.p1?.score).toBe(40);
  });
  it("ne marque aucun point lorsque tous les adversaires ont fermé", () => {
    let state = setMarks(createCricketGame(players, null), "p1", 20, 3); state = setMarks(state, "p2", 20, 3); state = registerCricketThrow(state, dart(20, 3)).state;
    expect(state.modeState.kind === "cricket" && state.modeState.players.p1?.score).toBe(0);
  });
  it("compte le bull extérieur pour une marque et le bull intérieur pour deux", () => {
    let state = createCricketGame(players, null); state = registerCricketThrow(state, bull()).state; state = registerCricketThrow(state, bull(true)).state;
    expect(state.modeState.kind === "cricket" && state.modeState.players.p1?.marks.bull).toBe(3);
  });
  it("ne gagne pas après avoir tout fermé si son score est inférieur", () => {
    let state = createCricketGame(players, null); if (state.modeState.kind !== "cricket") throw new Error();
    for (const target of [20, 19, 18, 17, 16, 15, "bull"] as CricketTarget[]) state = setMarks(state, "p1", target, target === 20 ? 2 : 3, 40);
    state = setMarks(state, "p2", 20, 0, 100); state = registerCricketThrow(state, dart(20, 1)).state; expect(state.status).toBe("in-progress");
    state = registerCricketThrow(state, dart(20, 3)).state; expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
  it("termine à la limite de manches avec le joueur le plus avancé", () => {
    let state = createCricketGame(players, 1); for (let index = 0; index < 3; index += 1) state = registerCricketThrow(state, dart(20, 1)).state; for (let index = 0; index < 3; index += 1) state = registerCricketThrow(state, dart(14, 1)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p1");
  });
});
