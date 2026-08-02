import { describe, expect, it } from "vitest";
import { deduplicatePlayerProfiles, normalizePlayerName } from "@/src/database/repositories/player-repository";
import type { SavedPlayer } from "@/src/database/database";

const profile = (id: string, name: string, updatedAt: string): SavedPlayer => ({ id, name, order: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt });

describe("profils joueurs", () => {
  it("normalise la casse et les espaces du pseudo", () => {
    expect(normalizePlayerName("  Jean   DUPONT ")).toBe("jean dupont");
  });

  it("ne conserve qu'un profil par pseudo normalisé", () => {
    const profiles = deduplicatePlayerProfiles([
      profile("old", "Joueur 1", "2026-01-01T00:00:00.000Z"),
      profile("other", "Alice", "2026-01-02T00:00:00.000Z"),
      profile("new", " joueur   1 ", "2026-01-03T00:00:00.000Z"),
    ]);
    expect(profiles.map((item) => item.id)).toEqual(["new", "other"]);
  });

  it("conserve deux profils homonymes appartenant à des comptes différents", () => {
    const first = { ...profile("one", "Joueur 1", "2026-01-01T00:00:00.000Z"), ownerUserId: "account-a" };
    const second = { ...profile("two", "Joueur 1", "2026-01-02T00:00:00.000Z"), ownerUserId: "account-b" };
    expect(deduplicatePlayerProfiles([first, second]).map((item) => item.id)).toEqual(["two", "one"]);
  });
});
