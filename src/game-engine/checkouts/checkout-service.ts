import type { DartMultiplier, DartZone, X01EntryRule, X01ExitRule } from "../types";

interface CheckoutDart { label: string; score: number; multiplier: DartMultiplier; zone: DartZone; segment: number | null; }
export interface CheckoutRoute { darts: string[]; quality: number; }

const throws: CheckoutDart[] = [
  ...Array.from({ length: 20 }, (_, index) => ({ label: `T${20 - index}`, score: (20 - index) * 3, segment: 20 - index, multiplier: 3 as const, zone: "triple" as const })),
  { label: "BULL", score: 50, segment: null, multiplier: 2, zone: "inner-bull" },
  ...Array.from({ length: 20 }, (_, index) => ({ label: `D${20 - index}`, score: (20 - index) * 2, segment: 20 - index, multiplier: 2 as const, zone: "double" as const })),
  { label: "25", score: 25, segment: null, multiplier: 1, zone: "outer-bull" },
  ...Array.from({ length: 20 }, (_, index) => ({ label: `S${20 - index}`, score: 20 - index, segment: 20 - index, multiplier: 1 as const, zone: "single-inner" as const })),
];

const qualifies = (dart: CheckoutDart, rule: X01EntryRule | X01ExitRule) => rule === "straight" ||
  (rule === "double" && (dart.multiplier === 2 || dart.zone === "inner-bull")) ||
  (rule === "master" && (dart.multiplier === 2 || dart.multiplier === 3 || dart.zone === "inner-bull"));

const DOUBLE_PREFERENCE: Record<number, number> = { 20: 120, 16: 115, 18: 108, 12: 104, 10: 100, 8: 98, 14: 94, 6: 90, 4: 88, 2: 84, 1: 80 };

function routeQuality(route: CheckoutDart[]): number {
  const last = route.at(-1); if (!last) return 0;
  let quality = 0;
  if (last.zone === "inner-bull") quality += 92;
  else if (last.multiplier === 2 && last.segment !== null) quality += DOUBLE_PREFERENCE[last.segment] ?? 65 - last.segment;
  else if (last.multiplier === 3) quality += 72 + (last.segment ?? 0) / 10;
  else quality += 45 + last.score / 100;
  for (const dart of route.slice(0, -1)) {
    if (dart.multiplier === 3) quality += 25 + dart.score / 100;
    else if (dart.multiplier === 1) quality += 18 + dart.score / 100;
    else quality += 14 + dart.score / 100;
  }
  return quality;
}

export function suggestCheckouts(score: number, dartsLeft: number, exitRule: X01ExitRule, entryRule: X01EntryRule = "straight", hasEntered = true, limit = 3): CheckoutRoute[] {
  if (score < 1 || score > 180 || dartsLeft < 1 || dartsLeft > 3 || limit < 1) return [];
  for (let length = 1; length <= dartsLeft; length += 1) {
    const routes: CheckoutDart[][] = [];
    const search = (remaining: number, route: CheckoutDart[]) => {
      const slots = length - route.length;
      for (const dart of throws) {
        if (route.length === 0 && !hasEntered && !qualifies(dart, entryRule)) continue;
        const after = remaining - dart.score;
        if (slots === 1) {
          if (after === 0 && qualifies(dart, exitRule)) routes.push([...route, dart]);
          continue;
        }
        if (after > 0 && after <= 60 * (slots - 1)) search(after, [...route, dart]);
      }
    };
    search(score, []);
    if (routes.length > 0) {
      const unique = new Map<string, CheckoutRoute>();
      for (const route of routes) {
        const darts = route.map((dart) => dart.label); const key = darts.join("-");
        unique.set(key, { darts, quality: routeQuality(route) });
      }
      return [...unique.values()].sort((a, b) => b.quality - a.quality || a.darts.join().localeCompare(b.darts.join())).slice(0, limit);
    }
  }
  return [];
}

export function suggestCheckout(score: number, dartsLeft: number, exitRule: X01ExitRule, entryRule: X01EntryRule = "straight", hasEntered = true): string[] | null {
  return suggestCheckouts(score, dartsLeft, exitRule, entryRule, hasEntered, 1)[0]?.darts ?? null;
}
