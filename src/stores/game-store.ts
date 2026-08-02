import { create } from "zustand";
import { abandonGame, createCountUpGame, createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import { processThrow } from "@/src/game-engine/game-engine";
import { useAnimationStore } from "@/src/stores/animation-store";
import { createX01Game } from "@/src/game-engine/x01";
import type { DartThrow, GameHistory, Player, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";
import type { GameState } from "@/src/game-engine/types";
import { saveGame } from "@/src/database/repositories/game-repository";

interface GameStore {
  history: GameHistory;
  hasStarted: boolean;
  start: (players: Player[], rounds: number) => void;
  startX01: (players: Player[], score: 301 | 501 | 701, entry: X01EntryRule, exit: X01ExitRule, rounds: number | null) => void;
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
  start: (players, rounds) => set(() => { const history = createHistory(createCountUpGame(players, rounds)); void saveGame(history.present); return { history, hasStarted: true }; }),
  startX01: (players, score, entry, exit, rounds) => set(() => { const history = createHistory(createX01Game(players, score, entry, exit, rounds)); void saveGame(history.present); return { history, hasStarted: true }; }),
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
