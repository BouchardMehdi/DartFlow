import { describe, expect, it } from "vitest";
import { calculateScore } from "@/src/game-engine/score-calculator";

describe("calculateScore", () => {
  it.each(Array.from({ length: 20 }, (_, index) => index + 1))("calcule le simple %i", (segment) => expect(calculateScore(segment, 1, "single-inner")).toBe(segment));
  it.each(Array.from({ length: 20 }, (_, index) => index + 1))("calcule le double %i", (segment) => expect(calculateScore(segment, 2, "double")).toBe(segment * 2));
  it.each(Array.from({ length: 20 }, (_, index) => index + 1))("calcule le triple %i", (segment) => expect(calculateScore(segment, 3, "triple")).toBe(segment * 3));
  it("calcule les bulls et le miss", () => { expect(calculateScore(null, 1, "outer-bull")).toBe(25); expect(calculateScore(null, 2, "inner-bull")).toBe(50); expect(calculateScore(null, 0, "miss")).toBe(0); });
});
