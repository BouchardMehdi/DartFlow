import { describe, expect, it } from "vitest";
import { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode, verifyRecoveryCode } from "../src/recovery.js";

describe("codes de récupération", () => {
  it("génère un code lisible avec 120 bits de données", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^DF-(?:[A-HJ-NP-Z2-9]{6}-){3}[A-HJ-NP-Z2-9]{6}$/);
    expect(normalizeRecoveryCode(code)).toHaveLength(24);
  });

  it("accepte les différences de casse et de séparateurs", () => {
    const code = generateRecoveryCode(); const hash = hashRecoveryCode(code);
    expect(verifyRecoveryCode(code.toLowerCase().replaceAll("-", " "), hash)).toBe(true);
  });

  it("refuse un autre code et un hash absent", () => {
    const code = generateRecoveryCode();
    expect(verifyRecoveryCode(generateRecoveryCode(), hashRecoveryCode(code))).toBe(false);
    expect(verifyRecoveryCode(code, null)).toBe(false);
  });
});
