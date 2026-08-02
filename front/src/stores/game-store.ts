import { create } from "zustand";
import { abandonGame, createCountUpGame, createHistory, undoLastThrow } from "@/src/game-engine/count-up";
import { processThrow } from "@/src/game-engine/game-engine";
import { useAnimationStore } from "@/src/stores/animation-store";
import { createX01Game } from "@/src/game-engine/x01";
import { createAroundTheClockGame } from "@/src/game-engine/around-the-clock";
import { createShanghaiGame } from "@/src/game-engine/shanghai";
import { createCricketGame } from "@/src/game-engine/cricket";
import { createKillerGame } from "@/src/game-engine/killer";
import { createTrainingGame } from "@/src/game-engine/training";
import type { AroundTheClockProgressionRule, CricketVariant, DartThrow, GameContext, GameHistory, Player, TrainingType, X01EntryRule, X01ExitRule } from "@/src/game-engine/types";
import type { GameState } from "@/src/game-engine/types";
import { saveGame } from "@/src/database/repositories/game-repository";
import { savePlayers } from "@/src/database/repositories/player-repository";

interface GameStore {
  history: GameHistory;
  hasStarted: boolean;
  start: (players: Player[], rounds: number, context?: GameContext) => void;
  startX01: (players: Player[], score: 301 | 501 | 701, entry: X01EntryRule, exit: X01ExitRule, rounds: number | null, legsToWin?: number, setsToWin?: number, context?: GameContext) => void;
  startAroundTheClock: (players: Player[], progression: AroundTheClockProgressionRule, bullFinish: boolean, rounds: number | null, direction?: "ascending" | "descending", context?: GameContext) => void;
  startShanghai: (players: Player[], rounds: number, instantWin: boolean, startTarget?: number, context?: GameContext) => void;
  startCricket: (players: Player[], rounds: number | null, variant: CricketVariant, context?: GameContext) => void;
  startKiller: (players: Player[], lives: number, selfDamage?: boolean, marksToKiller?: number, context?: GameContext) => void;
  startTraining: (players: Player[], trainingType: TrainingType, rounds?: number, context?: GameContext) => void;
  throwDart: (dart: DartThrow) => void;
  undo: () => void;
  abandon: () => void;
  restore: (state: GameState) => void;
}

const demoPlayers: Player[] = [
  { id: "player-1", name: "Joueur 1", color: "#c8f03d", order: 0 },
  { id: "player-2", name: "Joueur 2", color: "#ff6b35", order: 1 },
];
const inContext = (game: GameState, context?: GameContext): GameState => context ? { ...game, ...context } : game;

export const useGameStore = create<GameStore>((set) => ({
  history: createHistory(createCountUpGame(demoPlayers, 8)),
  hasStarted: false,
  start: (players, rounds, context) => set(() => { const history = createHistory(inContext(createCountUpGame(players, rounds), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startX01: (players, score, entry, exit, rounds, legsToWin = 1, setsToWin = 1, context) => set(() => { const history = createHistory(inContext(createX01Game(players, score, entry, exit, rounds, legsToWin, setsToWin), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startAroundTheClock: (players, progression, bullFinish, rounds, direction = "ascending", context) => set(() => { const history = createHistory(inContext(createAroundTheClockGame(players, progression, bullFinish, rounds, direction), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startShanghai: (players, rounds, instantWin, startTarget = 1, context) => set(() => { const history = createHistory(inContext(createShanghaiGame(players, rounds, instantWin, startTarget), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startCricket: (players, rounds, variant, context) => set(() => { const history = createHistory(inContext(createCricketGame(players, rounds, variant), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startKiller: (players, lives, selfDamage = false, marksToKiller = 3, context) => set(() => { const history = createHistory(inContext(createKillerGame(players, lives, { selfDamage, marksToKiller }), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
  startTraining: (players, trainingType, rounds = 10, context) => set(() => { const history = createHistory(inContext(createTrainingGame(players, trainingType, rounds), context)); void savePlayers(players); void saveGame(history.present); return { history, hasStarted: true }; }),
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
