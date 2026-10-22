import { expect, test, type Page } from "@playwright/test";
import type { CricketModeState, GameState } from "../src/game-engine/types";

test.use({ serviceWorkers: "block" });

async function localGame(page: Page): Promise<GameState | undefined> {
  return page.evaluate(() => new Promise<GameState | undefined>((resolve, reject) => {
    const request = indexedDB.open("dartflow");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("games").objectStore("games").getAll();
      read.onsuccess = () => { db.close(); resolve((read.result as GameState[]).find(game => game.modeId === "cricket")); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
}

for (const variant of ["random", "hidden"] as const) {
  test(`${variant} : sélection, saisie, découverte, annulation et reprise sur mobile`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      delete (Navigator.prototype as { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
    });
    await page.route("**/api/**", route => route.fulfill({ status: 401, json: { message: "Non connecté" } }));
    await page.goto("/new-game");
    await page.getByRole("combobox", { name: "Mode de jeu", exact: true }).click();
    await page.getByRole("option", { name: "Cricket standard", exact: true }).click();
    await page.getByRole("combobox", { name: "Variante du Cricket" }).click();
    await expect(page.getByRole("option")).toHaveCount(5);
    const label = variant === "random" ? "Random Cricket" : "Hidden Cricket";
    await page.getByRole("option", { name: label, exact: true }).click();
    await page.getByRole("button", { name: /Démarrer la partie/ }).click();
    await expect(page).toHaveURL(/\/game$/);
    const grid = page.getByRole("region", { name: "Grille Cricket" });
    await expect(grid).toBeVisible();
    await expect.poll(async () => (await localGame(page))?.modeState.kind).toBe("cricket");
    const initial = (await localGame(page))!.modeState as CricketModeState;
    const target = initial.targets!.find(value => typeof value === "number") as number;
    const rows = grid.getByRole("rowheader");
    if (variant === "hidden") await expect(grid.getByRole("rowheader", { name: /Cible masquée/ })).toHaveCount(7);
    else await expect(rows).toHaveText(initial.targets!.map(value => value === "bull" ? "BULL" : String(value)));

    await page.getByRole("button", { name: "Triple", exact: true }).click();
    await page.getByRole("button", { name: `Triple ${target}`, exact: true }).click();
    await expect(grid.getByRole("rowheader", { name: String(target), exact: true })).toBeVisible();
    await expect.poll(async () => ((await localGame(page))!.modeState as CricketModeState).players[initialPlayer(initial)]?.marks[target]).toBe(3);
    if (variant === "hidden") await expect(grid.getByRole("rowheader", { name: /Cible masquée/ })).toHaveCount(6);

    await page.getByRole("button", { name: "Annuler" }).click();
    if (variant === "hidden") await expect(grid.getByRole("rowheader", { name: /Cible masquée/ })).toHaveCount(7);
    await page.getByRole("button", { name: "Bull · 25" }).click();
    if (variant === "hidden") await expect(grid.getByRole("rowheader", { name: "BULL", exact: true })).toBeVisible();
    await expect.poll(async () => ((await localGame(page))!.modeState as CricketModeState).players[initialPlayer(initial)]?.marks.bull).toBe(1);
    await page.reload();
    await expect(grid).toBeVisible();
    const restored = (await localGame(page))!.modeState as CricketModeState;
    expect(restored.targets).toEqual(initial.targets);
    expect(restored.players[initialPlayer(initial)]?.marks.bull).toBe(1);
    if (variant === "hidden") await expect(grid.getByRole("rowheader", { name: /Cible masquée/ })).toHaveCount(6);
    await expect(page.locator("main > header")).toContainText(label);
    await page.getByRole("button", { name: "Règles", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(label);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`${variant}-rules.png`), fullPage: true, animations: "disabled" });
  });
}

function initialPlayer(state: CricketModeState) {
  return Object.keys(state.players)[0]!;
}
