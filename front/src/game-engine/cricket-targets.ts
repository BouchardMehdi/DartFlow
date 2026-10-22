import type { CricketModeState, CricketTarget, CricketVariant } from "./types";

export const CRICKET_TARGETS: readonly CricketTarget[] = [20, 19, 18, 17, 16, 15, "bull"];
export const CRICKET_VARIANTS: Record<CricketVariant, string> = {
  standard: "Cricket standard",
  "no-score": "Cricket sans points",
  "cut-throat": "Cut-Throat Cricket",
  random: "Random Cricket",
  hidden: "Hidden Cricket",
};

export const getCricketTargets = (state: CricketModeState): readonly CricketTarget[] => state.targets ?? CRICKET_TARGETS;
export const isCricketTargetVisible = (state: CricketModeState, target: CricketTarget) => state.variant !== "hidden" || state.revealedTargets?.includes(target) === true;
export const countClosedCricketTargets = (state: CricketModeState, playerId: string) => getCricketTargets(state).filter(target => (state.players[playerId]?.marks[target] ?? 0) >= 3).length;

export function randomCricketTargets(random: () => number = Math.random): CricketTarget[] {
  const numbers = Array.from({ length: 20 }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [numbers[index], numbers[other]] = [numbers[other]!, numbers[index]!];
  }
  return [...numbers.slice(0, 6).sort((a, b) => b - a), "bull"];
}
