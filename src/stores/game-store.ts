import { create } from "zustand";
import { abandonGame, createCountUpGame, createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import { processThrow } from "@/src/game-engine/game-engine";
import { useAnimationStore } from "@/src/stores/animation-store";
import { createX01Game } from "@/src/game-engine/x01";
import { createAroundTheClockGame } from "@/src/game-engine/around-the-clock";
import { createShanghaiGame } from "@/src/game-engine/shanghai";
import { createCricketGame } from "@/src/game-engine/cricket";
import { createKillerGame } from "@/src/game-engine/killer";
import type { AroundTheClockProgressionRule, CricketVariant, DartThrow, GameHistory, Player, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";
import type { GameState } from "@/src/game-engine/types";
import { saveGame } from "@/src/database/repositories/game-repository";
import { savePlayers } from "@/src/database/repositories/player-repository";

interface GameStore {
  history: GameHistory;
  hasStarted: boolean;
  start: (players: Player[], rounds: number) => void;
  startX01: (players: Player[], score: 301 | 501 | 701, entry: X01EntryRule, exit: X01ExitRule, rounds: number | null, legsToWin?: number, setsToWin?: number) => void;
  startAroundTheClock: (players: Player[], progression: AroundTheClockProgressionRule, bullFinish: boolean, rounds: number | null, direction?: "ascending" | "descending") => void;
  startShanghai: (players: Player[], rounds: number, instantWin: boolean, startTarget?: number) => void;
  startCricket: (players: Player[], rounds: number | null, variant: CricketVariant) => void;
  startKiller: (players: Player[], lives: number, selfDamage?: boolean, marksToKiller?: number) => void;
  throwDart: (dart: DartThrow) => void;
  undo: () => void;
  abandon: () => void;
  restore: (state: GameState) => void;
}

const demoPlayers: Player[] = [
  { id: "player-1", name: "Joueur 1", color: "#c8f03d", order: 0 },
  { id: "player-2", name: "Joueur 2", color: "#ff6b35", order: 1 },
];

export const useGameStore = create<GameStore>((set) => ({
  history: createHistory(createCountUpGame(demoPlayers, 8)),
  hasStarted: false,
  start: (players, rounds) => set(() => { const history = createHistory(createCountUpGame(players, rounds)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startX01: (players, score, entry, exit, rounds, legsToWin = 1, setsToWin = 1) => set(() => { const history = createHistory(createX01Game(players, score, entry, exit, rounds, legsToWin, setsToWin)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startAroundTheClock: (players, progression, bullFinish, rounds, direction = "ascending") => set(() => { const history = createHistory(createAroundTheClockGame(players, progression, bullFinish, rounds, direction)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startShanghai: (players, rounds, instantWin, startTarget = 1) => set(() => { const history = createHistory(createShanghaiGame(players, rounds, instantWin, startTarget)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startCricket: (players, rounds, variant) => set(() => { const history = createHistory(createCricketGame(players, rounds, variant)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startKiller: (players, lives, selfDamage = false, marksToKiller = 3) => set(() => { const history = createHistory(createKillerGame(players, lives, { selfDamage, marksToKiller })); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  throwDart: (dart) => set((store) => {
    const result = processThrow(store.history, dart);
    useAnimationStore.getState().enqueueEvents(result.events);
    void saveGame(result.history.present);
    return { history: result.history };
  }),
  undo: () => set((store) => { const history = undoLastThrow(store.history); void saveGame(history.present); return { history }; }),
  abandon: () => set((store) => { const history = { ...store.history, present: abandonGame(store.history.present) }; void saveGame(history.present); return { history, hasStarted: false }; }),
  restore: (state) => set({ history: createHistory(state), hasStarted: true }),
}));
