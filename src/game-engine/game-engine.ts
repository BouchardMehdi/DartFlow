import { applyCountUpThrow } from "./count-up";
import type { DartThrow, GameHistory } from "./types";
import { registerX01Throw } from "./x01";

export function applyThrow(history: GameHistory, dart: DartThrow): GameHistory {
  if (history.present.modeState.kind === "count-up") return applyCountUpThrow(history, dart);
  return { past: [...history.past, structuredClone(history.present)], present: registerX01Throw(history.present, dart).state };
}
