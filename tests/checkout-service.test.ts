import { describe, expect, it } from "vitest";
import { suggestCheckout, suggestCheckouts } from "@/src/game-engine/checkouts/checkout-service";

describe("suggestCheckout", () => {
  it("propose une sortie double-out avec les fléchettes disponibles", () => {
    const route = suggestCheckout(170, 3, "double");
    expect(route).toEqual(["T20", "T20", "BULL"]);
  });
  it("ne propose rien si le checkout demande trop de fléchettes", () => {
    expect(suggestCheckout(170, 2, "double")).toBeNull();
  });
  it("respecte le straight-out", () => {
    expect(suggestCheckout(60, 1, "straight")).toEqual(["T20"]);
  });
  it("respecte le master-out", () => {
    expect(suggestCheckout(60, 1, "master")).toEqual(["T20"]);
  });
  it("tient compte d'une entrée double-in non validée", () => {
    const route = suggestCheckout(40, 1, "double", "double", false);
    expect(route).toEqual(["D20"]);
  });
  it("ignore les scores hors de la plage de suggestion", () => {
    expect(suggestCheckout(181, 3, "double")).toBeNull();
  });
  it.each(["straight", "double", "master"] as const)("privilégie D20 pour 40 en %s-out", (rule) => {
    expect(suggestCheckout(40, 3, rule)).toEqual(["D20"]);
  });
  it("propose au maximum trois routes classées", () => {
    const routes = suggestCheckouts(100, 3, "double");
    expect(routes.length).toBeLessThanOrEqual(3);
    expect(routes[0]?.darts.length).toBe(2);
  });
});
