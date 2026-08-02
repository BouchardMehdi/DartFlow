import { applyCountUpThrow, registerThrow as registerCountUp } from "./count-up";
import type { DartThrow, GameEvent, GameHistory } from "./types";
import { registerX01Throw } from "./x01";
import { registerAroundTheClockThrow } from "./around-the-clock";
import { registerShanghaiThrow } from "./shanghai";
import { registerCricketThrow } from "./cricket";
import { registerKillerThrow } from "./killer";
import { registerTrainingThrow } from "./training";

export function applyThrow(history: GameHistory, dart: DartThrow): GameHistory {
  if (history.present.modeState.kind === "count-up") return applyCountUpThrow(history, dart);
  const state = history.present.modeState.kind === "x01" ? registerX01Throw(history.present, dart).state : history.present.modeState.kind === "around-the-clock" ? registerAroundTheClockThrow(history.present, dart).state : history.present.modeState.kind === "shanghai" ? registerShanghaiThrow(history.present, dart).state : history.present.modeState.kind === "cricket" ? registerCricketThrow(history.present, dart).state : history.present.modeState.kind === "killer" ? registerKillerThrow(history.present, dart).state : registerTrainingThrow(history.present, dart).state;
  return { past: [...history.past, structuredClone(history.present)], present: state };
}

export function processThrow(history: GameHistory, dart: DartThrow): { history: GameHistory; events: GameEvent[] } {
  const previous = structuredClone(history.present);
  const result = history.present.modeState.kind === "count-up" ? registerCountUp(history.present, dart) : history.present.modeState.kind === "x01" ? registerX01Throw(history.present, dart) : history.present.modeState.kind === "around-the-clock" ? registerAroundTheClockThrow(history.present, dart) : history.present.modeState.kind === "shanghai" ? registerShanghaiThrow(history.present, dart) : history.present.modeState.kind === "cricket" ? registerCricketThrow(history.present, dart) : history.present.modeState.kind === "killer" ? registerKillerThrow(history.present, dart) : registerTrainingThrow(history.present, dart);
  return { history: { past: [...history.past, previous], present: result.state }, events: result.events };
}
