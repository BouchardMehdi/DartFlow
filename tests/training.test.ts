import { describe, expect, it } from "vitest";
import { createTrainingGame, generateCheckoutTarget, generateRandomTarget, registerTrainingThrow } from "@/src/game-engine/training";
import type { DartThrow, GameState, Player } from "@/src/game-engine/types";
import { gameStateSchema } from "@/src/database/schemas";

const player: Player = { id: "p1", name: "Alice", order: 0 };
const dart = (segment: number, multiplier: 1 | 2 | 3): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", thrownAt: new Date().toISOString() });
const miss = (): DartThrow => ({ id: crypto.randomUUID(), segment: null, multiplier: 0, score: 0, zone: "miss", thrownAt: new Date().toISOString() });

describe("modes d'entraînement", () => {
  it("requiert exactement un joueur", () => {
    expect(() => createTrainingGame([], "doubles")).toThrow();
    expect(() => createTrainingGame([player, { ...player, id: "p2" }], "doubles")).toThrow();
  });

  it("produit un état compatible avec la sauvegarde locale", () => {
    expect(gameStateSchema.safeParse(createTrainingGame([player], "random-target", 10, () => 0)).success).toBe(true);
  });

  it("fait travailler les doubles de D1 à D20", () => {
    let state = createTrainingGame([player], "doubles");
    state = registerTrainingThrow(state, dart(1, 2)).state;
    state = registerTrainingThrow(state, dart(1, 1)).state;
    state = registerTrainingThrow(state, dart(1, 2)).state;
    expect(state.currentRound).toBe(2);
    expect(state.modeState.kind === "training" && state.modeState.target?.label).toBe("D2");
    expect(state.modeState.kind === "training" && state.modeState.score).toBe(2);
  });

  it("ne valide que le triple exact en entraînement aux triples", () => {
    let state = createTrainingGame([player], "triples");
    state = registerTrainingThrow(state, dart(1, 2)).state;
    state = registerTrainingThrow(state, dart(1, 3)).state;
    expect(state.modeState.kind === "training" && state.modeState.score).toBe(1);
  });

  it("applique les gains et pénalités classiques de Bob's 27", () => {
    let missed = createTrainingGame([player], "bobs-27");
    for (let index = 0; index < 3; index += 1) missed = registerTrainingThrow(missed, miss()).state;
    expect(missed.modeState.kind === "training" && missed.modeState.score).toBe(25);
    let hit = createTrainingGame([player], "bobs-27");
    hit = registerTrainingThrow(hit, dart(1, 2)).state; hit = registerTrainingThrow(hit, dart(1, 2)).state; hit = registerTrainingThrow(hit, miss()).state;
    expect(hit.modeState.kind === "training" && hit.modeState.score).toBe(31);
  });

  it("arrête Bob's 27 lorsque le score devient négatif", () => {
    let state = createTrainingGame([player], "bobs-27");
    if (state.modeState.kind !== "training") throw new Error();
    state = { ...state, currentTurn: { ...state.currentTurn, scoreBeforeTurn: 0, scoreAfterTurn: 0 }, modeState: { ...state.modeState, score: 0 } } as GameState;
    for (let index = 0; index < 3; index += 1) state = registerTrainingThrow(state, miss()).state;
    expect(state.status).toBe("completed"); expect(state.modeState.kind === "training" && state.modeState.score).toBe(-2);
  });

  it("propose uniquement des checkouts réalisables en trois fléchettes", () => {
    expect(generateCheckoutTarget(() => 0)).toBe(2);
    expect(generateCheckoutTarget(() => .999)).toBe(170);
  });

  it("enchaîne et compte les checkouts réussis", () => {
    let state = createTrainingGame([player], "checkout", 2, () => 0);
    state = registerTrainingThrow(state, dart(1, 2), () => 0).state;
    expect(state.currentRound).toBe(2); expect(state.modeState.kind === "training" && state.modeState.score).toBe(1);
    state = registerTrainingThrow(state, dart(1, 2), () => 0).state;
    expect(state.status).toBe("completed"); expect(state.modeState.kind === "training" && state.modeState.successes).toBe(2);
  });

  it("considère une sortie simple comme un bust en Checkout Challenge", () => {
    let state = createTrainingGame([player], "checkout", 1, () => 0);
    state = registerTrainingThrow(state, dart(2, 1), () => 0).state;
    expect(state.status).toBe("completed"); expect(state.turns[0]?.isBust).toBe(true);
  });

  it("change de cible après chaque lancer aléatoire", () => {
    expect(generateRandomTarget(() => .999).label).toBe("BULL");
    let state = createTrainingGame([player], "random-target", 1, () => 0);
    for (let index = 0; index < 3; index += 1) state = registerTrainingThrow(state, dart(1, 1), () => 0).state;
    expect(state.status).toBe("completed"); expect(state.modeState.kind === "training" && state.modeState.score).toBe(3); expect(state.modeState.kind === "training" && state.modeState.attempts).toBe(3);
  });
});
