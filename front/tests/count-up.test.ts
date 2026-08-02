import { describe, expect, it } from "vitest";
import { abandonGame, createCountUpGame, createHistory, registerThrow, undoLastThrow } from "@/src/game-engine/count-up";
import { applyThrow } from "@/src/game-engine/game-engine";
import type { DartThrow, Player } from "@/src/game-engine/types";

const dart = (score = 20): DartThrow => ({ id: crypto.randomUUID(), segment: 20, multiplier: 1, zone: "single-inner", score, thrownAt: new Date().toISOString() });
const players = (count: number): Player[] => Array.from({ length: count }, (_, order) => ({ id: `p${order}`, name: `Joueur ${order + 1}`, order }));

describe("Count-Up", () => {
  it.each([1,2,3,4,5,6,7,8])("accepte et fait tourner %i joueur(s)", (count) => {
    let state = createCountUpGame(players(count), 2);
    for (let i = 0; i < 3; i += 1) state = registerThrow(state, dart()).state;
    expect(state.currentPlayerIndex).toBe(count === 1 ? 0 : 1);
    expect(state.currentRound).toBe(count === 1 ? 2 : 1);
  });
  it("additionne trois fléchettes puis change de joueur", () => {
    let state = createCountUpGame(players(2));
    state = registerThrow(state, dart(20)).state; state = registerThrow(state, dart(40)).state; state = registerThrow(state, dart(60)).state;
    expect(state.modeState.kind).toBe("count-up");
    if (state.modeState.kind !== "count-up") throw new Error();
    expect(state.modeState.scores.p0).toBe(120); expect(state.currentPlayerIndex).toBe(1); expect(state.turns[0]?.isCompleted).toBe(true);
  });
  it("annule par restauration exacte de l’état précédent", () => {
    const initial = createCountUpGame(players(2));
    const history = applyThrow(createHistory(initial), dart(60));
    expect(undoLastThrow(history).present).toEqual(initial);
  });
  it("termine après la dernière manche et choisit le meilleur score", () => {
    let state = createCountUpGame(players(2), 1);
    for (let i = 0; i < 3; i += 1) state = registerThrow(state, dart(20)).state;
    for (let i = 0; i < 3; i += 1) state = registerThrow(state, dart(10)).state;
    expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p0");
  });
  it("refuse une taille de partie invalide", () => { expect(() => createCountUpGame(players(0))).toThrow(); expect(() => createCountUpGame(players(9))).toThrow(); });
  it("permet d'abandonner une partie en cours", () => {
    const state = abandonGame(createCountUpGame(players(2)));
    expect(state.status).toBe("cancelled");
  });
});
