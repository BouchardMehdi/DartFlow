import type { GameEvent } from "./types";

export function getTurnScoreEvent(score: number): GameEvent | undefined {
  if (score === 180) return { type: "SCORE_180", score: 180 };
  if (score >= 140) return { type: "SCORE_140_PLUS", score };
  if (score >= 100) return { type: "SCORE_100_PLUS", score };
  return undefined;
}
