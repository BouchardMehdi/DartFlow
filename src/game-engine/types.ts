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

export type X01EntryRule = "straight" | "double" | "master";
export type X01ExitRule = "straight" | "double" | "master";

export interface X01PlayerState {
  score: number;
  hasEntered: boolean;
  legsWon: number;
  setsWon: number;
}

export interface X01ModeState {
  kind: "x01";
  startingScore: 301 | 501 | 701;
  entryRule: X01EntryRule;
  exitRule: X01ExitRule;
  maxRounds: number | null;
  legsToWin: number;
  setsToWin: number;
  legStarterIndex: number;
  players: Record<string, X01PlayerState>;
}

export type AroundTheClockProgressionRule = "single-only" | "any-hit" | "multiplier";
export interface AroundTheClockPlayerState { target: number; completed: boolean; }
export interface AroundTheClockModeState {
  kind: "around-the-clock";
  progressionRule: AroundTheClockProgressionRule;
  direction: "ascending" | "descending";
  bullFinish: boolean;
  maxRounds: number | null;
  players: Record<string, AroundTheClockPlayerState>;
}

export interface ShanghaiModeState {
  kind: "shanghai";
  startTarget: number;
  maxRounds: number;
  instantShanghaiWin: boolean;
  scores: Record<string, number>;
}

export type CricketTarget = 20 | 19 | 18 | 17 | 16 | 15 | "bull";
export type CricketVariant = "standard" | "no-score" | "cut-throat";
export interface CricketPlayerState { score: number; marks: Record<CricketTarget, number>; }
export interface CricketModeState {
  kind: "cricket";
  variant: CricketVariant;
  maxRounds: number | null;
  players: Record<string, CricketPlayerState>;
}

export interface KillerPlayerState { number: number; marks: number; isKiller: boolean; lives: number; eliminated: boolean; }
export interface KillerModeState {
  kind: "killer";
  startingLives: number;
  marksToKiller: number;
  selfDamage: boolean;
  players: Record<string, KillerPlayerState>;
}

export interface GameState {
  id: string;
  modeId: "count-up" | "x01" | "around-the-clock" | "shanghai" | "cricket" | "killer";
  status: "setup" | "in-progress" | "paused" | "completed" | "cancelled";
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  currentTurn: Turn;
  turns: Turn[];
  modeState: CountUpModeState | X01ModeState | AroundTheClockModeState | ShanghaiModeState | CricketModeState | KillerModeState;
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
  | { type: "BUST"; playerId: string }
  | { type: "CHECKOUT"; playerId: string }
  | { type: "LEG_WON"; playerId: string }
  | { type: "SET_WON"; playerId: string }
  | { type: "SCORE_100_PLUS"; score: number }
  | { type: "SCORE_140_PLUS"; score: number }
  | { type: "SCORE_180"; score: 180 }
  | { type: "SHANGHAI"; playerId: string; target: number }
  | { type: "CRICKET_CLOSED"; playerId: string; target: CricketTarget }
  | { type: "KILLER_ACHIEVED"; playerId: string }
  | { type: "PLAYER_ELIMINATED"; playerId: string }
  | { type: "GAME_WON"; playerId: string };

export interface EngineResult { state: GameState; events: GameEvent[]; }
export interface GameHistory { present: GameState; past: GameState[]; }
