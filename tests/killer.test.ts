import { describe, expect, it } from "vitest";
import { assignKillerNumbers, createKillerGame, registerKillerThrow } from "@/src/game-engine/killer";
import type { DartThrow, GameState, Player } from "@/src/game-engine/types";

const players = (count = 3): Player[] => Array.from({ length: count }, (_, order) => ({ id: `p${order}`, name: `Joueur ${order + 1}`, order }));
const dart = (segment: number, multiplier: 1 | 2 | 3 = 1): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 1 ? "single-inner" : multiplier === 2 ? "double" : "triple", thrownAt: new Date().toISOString() });
const miss = (): DartThrow => ({ id: crypto.randomUUID(), segment: null, multiplier: 0, score: 0, zone: "miss", thrownAt: new Date().toISOString() });
const makeKiller = (state: GameState, playerId = "p0"): GameState => { if (state.modeState.kind !== "killer") throw new Error(); const player = state.modeState.players[playerId]; if (!player) throw new Error(); return { ...state, modeState: { ...state.modeState, players: { ...state.modeState.players, [playerId]: { ...player, marks: 3, isKiller: true } } } }; };

describe("Killer", () => {
  it("attribue des numéros uniques entre 1 et 20", () => {
    const assigned = Object.values(assignKillerNumbers(players(8), () => 0));
    expect(new Set(assigned).size).toBe(8); expect(assigned.every((number) => number >= 1 && number <= 20)).toBe(true);
  });
  it("requiert au moins deux joueurs", () => { expect(() => createKillerGame(players(1), 3)).toThrow(); });
  it("devient Killer après trois marques sur son numéro", () => {
    let state = createKillerGame(players(), 3, () => 0); if (state.modeState.kind !== "killer") throw new Error(); const number = state.modeState.players.p0?.number; if (!number) throw new Error();
    state = registerKillerThrow(state, dart(number, 3)).state; expect(state.modeState.kind === "killer" && state.modeState.players.p0?.isKiller).toBe(true);
  });
  it("retire une, deux ou trois vies selon le multiplicateur", () => {
    let state = makeKiller(createKillerGame(players(), 5, () => 0)); if (state.modeState.kind !== "killer") throw new Error(); const victimNumber = state.modeState.players.p1?.number; if (!victimNumber) throw new Error();
    state = registerKillerThrow(state, dart(victimNumber, 2)).state; expect(state.modeState.kind === "killer" && state.modeState.players.p1?.lives).toBe(3);
  });
  it("n'inflige aucun auto-dégât", () => {
    let state = makeKiller(createKillerGame(players(), 3, () => 0)); if (state.modeState.kind !== "killer") throw new Error(); const ownNumber = state.modeState.players.p0?.number; if (!ownNumber) throw new Error();
    state = registerKillerThrow(state, dart(ownNumber, 3)).state; expect(state.modeState.kind === "killer" && state.modeState.players.p0?.lives).toBe(3);
  });
  it("élimine et saute automatiquement un joueur", () => {
    let state = makeKiller(createKillerGame(players(), 1, () => 0)); if (state.modeState.kind !== "killer") throw new Error(); const victimNumber = state.modeState.players.p1?.number; if (!victimNumber) throw new Error();
    state = registerKillerThrow(state, dart(victimNumber)).state; state = registerKillerThrow(state, miss()).state; state = registerKillerThrow(state, miss()).state;
    expect(state.modeState.kind === "killer" && state.modeState.players.p1?.eliminated).toBe(true); expect(state.currentPlayerIndex).toBe(2);
  });
  it("fait gagner le dernier joueur non éliminé", () => {
    let state = makeKiller(createKillerGame(players(2), 1, () => 0)); if (state.modeState.kind !== "killer") throw new Error(); const victimNumber = state.modeState.players.p1?.number; if (!victimNumber) throw new Error();
    state = registerKillerThrow(state, dart(victimNumber)).state; expect(state.status).toBe("completed"); expect(state.winnerId).toBe("p0");
  });
});
