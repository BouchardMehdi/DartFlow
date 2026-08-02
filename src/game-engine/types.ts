export type DartMultiplier = 0 | 1 | 2 | 3;
export type DartZone = "miss" | "single-inner" | "single-outer" | "double" | "triple" | "outer-bull" | "inner-bull";

export interface DartThrow {
  id: string;
  segment: number | null;
  multiplier: DartMultiplier;
  score: number;
  zone: DartZone;
  thrownAt: string;
}

export interface Player {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  order: number;
}

export interface Turn {
  id: string;
  playerId: string;
  roundNumber: number;
  darts: DartThrow[];
  scoreBeforeTurn: number;
  scoreAfterTurn: number;
  turnScore: number;
  isBust: boolean;
  isCompleted: boolean;
  createdAt: string;
}

export interface CountUpModeState {
  kind: "count-up";
  maxRounds: number;
  scores: Record<string, number>;
}

export interface GameState {
  id: string;
  modeId: "count-up";
  status: "setup" | "in-progress" | "paused" | "completed" | "cancelled";
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  currentTurn: Turn;
  turns: Turn[];
  modeState: CountUpModeState;
  winnerId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type GameEvent =
  | { type: "DART_REGISTERED"; dart: DartThrow }
  | { type: "DOUBLE_HIT"; dart: DartThrow }
  | { type: "TRIPLE_HIT"; dart: DartThrow }
  | { type: "BULL_HIT"; dart: DartThrow }
  | { type: "TURN_COMPLETED"; turn: Turn }
  | { type: "PLAYER_CHANGED"; playerId: string }
  | { type: "GAME_WON"; playerId: string };

export interface EngineResult { state: GameState; events: GameEvent[]; }
export interface GameHistory { present: GameState; past: GameState[]; }
