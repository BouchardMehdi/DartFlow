import { create } from "zustand";
import { applyThrow, createCountUpGame, createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import type { DartThrow, GameHistory, Player } from "@/src/game-engine/types";

interface GameStore {
  history: GameHistory;
  start: (players: Player[], rounds: number) => void;
  throwDart: (dart: DartThrow) => void;
  undo: () => void;
}

const demoPlayers: Player[] = [
  { id: "player-1", name: "Joueur 1", color: "#c8f03d", order: 0 },
  { id: "player-2", name: "Joueur 2", color: "#ff6b35", order: 1 },
];

export const useGameStore = create<GameStore>((set) => ({
  history: createHistory(createCountUpGame(demoPlayers, 8)),
  start: (players, rounds) => set({ history: createHistory(createCountUpGame(players, rounds)) }),
  throwDart: (dart) => set((store) => ({ history: applyThrow(store.history, dart) })),
  undo: () => set((store) => ({ history: undoLastThrow(store.history) })),
}));
