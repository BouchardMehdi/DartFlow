import type { DartMultiplier, DartThrow, DartZone } from "./types";

export function calculateScore(segment: number | null, multiplier: DartMultiplier, zone: DartZone): number {
  if (zone === "miss") return 0;
  if (zone === "outer-bull") return 25;
  if (zone === "inner-bull") return 50;
  if (segment === null || segment < 1 || segment > 20 || multiplier < 1) throw new Error("Lancer invalide");
  return segment * multiplier;
}

export function createDart(segment: number | null, multiplier: DartMultiplier, zone: DartZone, now = new Date()): DartThrow {
  return { id: crypto.randomUUID(), segment, multiplier, zone, score: calculateScore(segment, multiplier, zone), thrownAt: now.toISOString() };
}
