import { create } from "zustand";
import { abandonGame, createCountUpGame, createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import { applyThrow } from "@/src/game-engine/game-engine";
import { createX01Game } from "@/src/game-engine/x01";
import type { DartThrow, GameHistory, Player, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";

interface GameStore {
  history: GameHistory;
  hasStarted: boolean;
  start: (players: Player[], rounds: number) => void;
  startX01: (players: Player[], score: 301 | 501 | 701, entry: X01EntryRule, exit: X01ExitRule, rounds: number | null) => void;
  throwDart: (dart: DartThrow) => void;
  undo: () => void;
  abandon: () => void;
}

const demoPlayers: Player[] = [
  { id: "player-1", name: "Joueur 1", color: "#c8f03d", order: 0 },
  { id: "player-2", name: "Joueur 2", color: "#ff6b35", order: 1 },
];

export const useGameStore = create<GameStore>((set) => ({
  history: createHistory(createCountUpGame(demoPlayers, 8)),
  hasStarted: false,
  start: (players, rounds) => set({ history: createHistory(createCountUpGame(players, rounds)), hasStarted: true }),
  startX01: (players, score, entry, exit, rounds) => set({ history: createHistory(createX01Game(players, score, entry, exit, rounds)), hasStarted: true }),
  throwDart: (dart) => set((store) => ({ history: applyThrow(store.history, dart) })),
  undo: () => set((store) => ({ history: undoLastThrow(store.history) })),
  abandon: () => set((store) => ({
    history: { ...store.history, present: abandonGame(store.history.present) },
    hasStarted: false,
  })),
}));
