import { describe, expect, it } from "vitest";
import { buildLeaderboard, normalizeEmail, normalizeName, remapIdentifiers } from "../src/domain.js";

describe("domain helpers", () => {
  it("normalise les noms et emails", () => {
    expect(normalizeName("  Joueur   Élite ")).toBe("joueur élite");
    expect(normalizeEmail(" Test@Example.COM ")).toBe("test@example.com");
  });

  it("remplace les identifiants dans les clés et valeurs", () => {
    expect(remapIdentifiers({ old: { id: "old" } }, { old: "new" })).toEqual({ new: { id: "new" } });
  });

  it("classe les profils publics à partir des parties", () => {
    const rows = buildLeaderboard([{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }], [{ mode_id: "x01", state: { players: [{ id: "a" }, { id: "b" }], winnerId: "a", turns: [{ playerId: "a", darts: [{}, {}], turnScore: 80 }, { playerId: "b", darts: [{}], turnScore: 20 }] } }]);
    expect(rows[0]).toMatchObject({ name: "Alice", wins: 1, averagePerDart: 40 });
  });
});
