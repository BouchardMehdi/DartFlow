import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CricketScoreboard } from "@/components/game/CricketScoreboard";
import { gameStateSchema } from "@/src/database/schemas";
import { createCricketGame, registerCricketThrow } from "@/src/game-engine/cricket";
import { CRICKET_TARGETS, countClosedCricketTargets, getCricketTargets } from "@/src/game-engine/cricket-targets";
import { createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import { processThrow } from "@/src/game-engine/game-engine";
import { getFinalStandings } from "@/src/game-engine/statistics";
import { buildProfileStatistics } from "@/src/statistics/profile-statistics";
import type { CricketModeState, DartThrow, GameState, Player } from "@/src/game-engine/types";

afterEach(cleanup);
const players: Player[] = [{ id: "p1", name: "Alice", order: 0 }, { id: "p2", name: "Bob", order: 1 }];
const dart = (segment: number, multiplier: 1 | 2 | 3 = 1): DartThrow => ({ id: crypto.randomUUID(), segment, multiplier, score: segment * multiplier, zone: multiplier === 3 ? "triple" : multiplier === 2 ? "double" : "single-inner", thrownAt: new Date().toISOString() });
const bull: DartThrow = { id: "bull", segment: null, multiplier: 2, score: 50, zone: "inner-bull", thrownAt: new Date().toISOString() };
const mode = (game: GameState): CricketModeState => {
  if (game.modeState.kind !== "cricket") throw new Error("Expected Cricket");
  return game.modeState;
};
const create = (variant: "random" | "hidden", rounds: number | null = null) => createCricketGame(players, rounds, variant, new Date(), () => 0);

describe.each(["random", "hidden"] as const)("Cricket %s", variant => {
  it("tire six numéros distincts entre 1 et 20 et le bull, communs à tous", () => {
    const state = mode(create(variant));
    expect(state.targets).toHaveLength(7);
    expect(new Set(state.targets).size).toBe(7);
    expect(state.targets).toContain("bull");
    expect(state.targets?.filter(target => typeof target === "number").every(target => target >= 1 && target <= 20)).toBe(true);
    expect(state.players.p1?.marks).toEqual(state.players.p2?.marks);
    expect(Object.values(state.players.p1!.marks)).toEqual(Array(7).fill(0));
  });

  it("compte les secteurs sous 15, ignore les autres et conserve le tirage", () => {
    const game = create(variant);
    const initial = structuredClone(mode(game));
    let result = registerCricketThrow(game, dart(2, 3)).state;
    result = registerCricketThrow(result, dart(20, 3)).state;
    expect(mode(result).players.p1?.marks[2]).toBe(3);
    expect(mode(result).players.p1?.marks[20]).toBeUndefined();
    expect(mode(result).targets).toEqual(initial.targets);
    expect(mode(game)).toEqual(initial);
  });

  it("marque ses propres points et arrête de compter une cible fermée par tous", () => {
    let game = create(variant);
    game = registerCricketThrow(game, dart(2, 2)).state;
    game = registerCricketThrow(game, dart(2, 3)).state;
    expect(mode(game).players.p1?.score).toBe(4);
    expect(mode(game).players.p2?.score).toBe(0);
    game = registerCricketThrow(game, dart(20)).state;
    game = registerCricketThrow(game, dart(2, 3)).state;
    game = registerCricketThrow(game, dart(2, 3)).state;
    expect(mode(game).players.p2?.score).toBe(0);
  });

  it("gagne sur les sept cibles du tirage, avec un score au moins égal", () => {
    let game = create(variant);
    const state = mode(game);
    const marks = Object.fromEntries(getCricketTargets(state).map(target => [target, target === 2 ? 2 : 3]));
    game = { ...game, modeState: { ...state, revealedTargets: [...getCricketTargets(state)], players: { ...state.players, p1: { score: 0, marks }, p2: { ...state.players.p2!, score: 10 } } } };
    game = registerCricketThrow(game, dart(2)).state;
    expect(game.status).toBe("in-progress");
    game = registerCricketThrow(game, dart(2, 3)).state;
    expect(game.status).toBe("in-progress");
    game = registerCricketThrow(game, dart(2, 3)).state;
    expect(game.status).toBe("completed");
    expect(game.winnerId).toBe("p1");
    expect(countClosedCricketTargets(mode(game), "p1")).toBe(7);
  });

  it("termine à la limite de manches selon les fermetures du tirage", () => {
    let game = create(variant, 1);
    for (const segment of [2, 20, 20, 20, 20, 20]) game = registerCricketThrow(game, dart(segment, 3)).state;
    expect(game.status).toBe("completed");
    expect(game.winnerId).toBe("p1");
    expect(getFinalStandings(game)[0]?.playerId).toBe("p1");
  });

  it("restaure les cibles, découvertes et marques après sérialisation", () => {
    const game = registerCricketThrow(create(variant), dart(2)).state;
    const restored = gameStateSchema.parse(JSON.parse(JSON.stringify(game)));
    expect(restored.modeState).toEqual(game.modeState);
    expect(registerCricketThrow(restored as GameState, bull).state.modeState.kind).toBe("cricket");
  });
});

describe("Découvertes du Hidden Cricket", () => {
  it("masque les sept cibles et ne les révèle ni dans les textes ni dans les libellés accessibles", () => {
    render(<CricketScoreboard state={mode(create("hidden"))} players={players} activePlayerId="p1" />);
    expect(screen.getAllByRole("rowheader", { name: /Cible masquée/ })).toHaveLength(7);
    expect(screen.queryByRole("rowheader", { name: "2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("rowheader", { name: "BULL" })).not.toBeInTheDocument();
  });

  it("révèle la cible au premier impact, pour tous, sans perdre ses marques", () => {
    let game = registerCricketThrow(create("hidden"), dart(20, 3)).state;
    expect(mode(game).revealedTargets).toEqual([]);
    game = registerCricketThrow(game, dart(2, 2)).state;
    game = registerCricketThrow(game, bull).state;
    expect(mode(game).revealedTargets).toEqual([2, "bull"]);
    expect(mode(game).players.p1?.marks[2]).toBe(2);
    expect(mode(game).players.p1?.marks.bull).toBe(2);
    render(<CricketScoreboard state={mode(game)} players={players} activePlayerId="p2" />);
    expect(screen.getByRole("rowheader", { name: "2" })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "BULL" })).toBeVisible();
    expect(screen.getAllByRole("rowheader", { name: /Cible masquée/ })).toHaveLength(5);
  });

  it("annule aussi la découverte et ne change jamais le tirage", () => {
    const original = create("hidden");
    const { history } = processThrow(createHistory(original), dart(2));
    expect(mode(history.present).revealedTargets).toEqual([2]);
    expect(undoLastThrow(history).present).toEqual(original);
  });
});

describe("Compatibilité et validation du Cricket", () => {
  it("restaure les anciennes parties dépourvues de tirage et de variante", () => {
    const game = createCricketGame(players, null);
    const state = mode(game);
    delete state.targets;
    delete state.revealedTargets;
    const legacy = JSON.parse(JSON.stringify(game));
    delete legacy.modeState.variant;
    const restored = gameStateSchema.parse(legacy) as GameState;
    expect(getCricketTargets(mode(restored))).toEqual(CRICKET_TARGETS);
    expect(mode(registerCricketThrow(restored, dart(20, 3)).state).players.p1?.marks[20]).toBe(3);
  });

  it("refuse les tirages incomplets, doublons et découvertes hors du tirage", () => {
    const game = create("hidden");
    const state = mode(game);
    for (const patch of [{ targets: undefined }, { targets: [2, 2, 3, 4, 5, 6, "bull"] }, { targets: [0, 2, 3, 4, 5, 6, "bull"] }, { revealedTargets: [20] }, { revealedTargets: undefined }]) {
      expect(gameStateSchema.safeParse({ ...game, modeState: { ...state, ...patch } }).success).toBe(false);
    }
  });

  it("sépare les statistiques des deux nouvelles variantes", () => {
    const games = (["random", "hidden"] as const).map(variant => ({ ...create(variant), status: "completed" as const, winnerId: "p1" }));
    const profile = { ...players[0]!, createdAt: games[0]!.createdAt, updatedAt: games[0]!.updatedAt };
    expect(buildProfileStatistics([profile], games)[0]?.modes.map(item => item.key).sort()).toEqual(["cricket-hidden", "cricket-random"]);
    expect(buildProfileStatistics([profile], games)[0]?.modes.map(item => item.label).sort()).toEqual(["Hidden Cricket", "Random Cricket"]);
  });
});
