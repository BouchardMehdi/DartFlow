import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/database.js", () => ({ pool: { query: vi.fn() } }));
import { pool } from "../src/database.js";
import leaderboardRoutes from "../src/routes/leaderboard.js";

beforeEach(() => vi.clearAllMocks());

describe("Classement des variantes X01", () => {
  it.each([301, 501, 701, 901, 1101, 1501])("filtre le %i dans les parties X01", async score => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const app = Fastify();
    await app.register(leaderboardRoutes, { prefix: "/leaderboard" });
    try {
      const response = await app.inject(`/leaderboard/?mode=${score}`);
      expect(response.statusCode).toBe(200);
      expect(response.json().rows).toEqual([]);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("g.state->'modeState'->>'startingScore'=$2"), ["x01", String(score)]);
    } finally { await app.close(); }
  });

  it("refuse un score qui ne correspond à aucune variante", async () => {
    const app = Fastify();
    await app.register(leaderboardRoutes, { prefix: "/leaderboard" });
    try {
      const response = await app.inject("/leaderboard/?mode=1201");
      expect(response.statusCode).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
