import { expect, test, type Page } from "@playwright/test";
import type { GameState } from "../src/game-engine/types";

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "parallel" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
  });
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: { message: "Non connecté" } }));
});

async function choose(page: Page, label: string | RegExp, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function savedGame(page: Page): Promise<GameState | undefined> {
  return page.evaluate(() => new Promise<GameState | undefined>((resolve, reject) => {
    const request = indexedDB.open("dartflow");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("games").objectStore("games").getAll();
      read.onsuccess = () => { db.close(); resolve(read.result[0] as GameState | undefined); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
}

const cases = [
  { family: "Classique", variant: "301", expected: { kind: "x01", startingScore: 301 } },
  { family: "Classique", variant: "501", expected: { kind: "x01", startingScore: 501 } },
  { family: "Classique", variant: "701", expected: { kind: "x01", startingScore: 701 } },
  { family: "Classique", variant: "901", expected: { kind: "x01", startingScore: 901 } },
  { family: "Classique", variant: "1101", expected: { kind: "x01", startingScore: 1101 } },
  { family: "Classique", variant: "1501", expected: { kind: "x01", startingScore: 1501 } },
  { family: "Cricket", variant: "Cricket standard", expected: { kind: "cricket", variant: "standard" } },
  { family: "Cricket", variant: "Cricket sans points", expected: { kind: "cricket", variant: "no-score" } },
  { family: "Cricket", variant: "Cut-Throat Cricket", expected: { kind: "cricket", variant: "cut-throat" } },
  { family: "Cricket", variant: "Random Cricket", expected: { kind: "cricket", variant: "random" } },
  { family: "Cricket", variant: "Hidden Cricket", expected: { kind: "cricket", variant: "hidden" } },
  { family: "Entraînement", variant: "Doubles", expected: { kind: "training", trainingType: "doubles" } },
  { family: "Entraînement", variant: "Triples", expected: { kind: "training", trainingType: "triples" } },
  { family: "Entraînement", variant: "Checkout Challenge", expected: { kind: "training", trainingType: "checkout" } },
  { family: "Entraînement", variant: "Bob’s 27", expected: { kind: "training", trainingType: "bobs-27" } },
  { family: "Entraînement", variant: "Cible aléatoire", expected: { kind: "training", trainingType: "random-target" } },
  { family: "Count-Up", variant: null, expected: { kind: "count-up" } },
  { family: "Around the Clock", variant: null, expected: { kind: "around-the-clock" } },
  { family: "Shanghai", variant: null, expected: { kind: "shanghai" } },
  { family: "Killer", variant: null, expected: { kind: "killer" } },
];

for (const item of cases) {
  test(`démarre ${item.family}${item.variant ? ` / ${item.variant}` : " sans variante"}`, async ({ page }) => {
    const newClassic = ["901", "1101", "1501"].includes(item.variant ?? "");
    if (newClassic) await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/new-game");
    await choose(page, "Mode de jeu", item.family);
    const variant = page.getByRole("combobox", { name: /^Variante/ });
    if (item.variant) {
      await expect(variant).toHaveCount(1);
      await choose(page, /^Variante/, item.variant);
    } else await expect(variant).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Démarrer la partie/ })).toBeEnabled();
    await page.getByRole("button", { name: /Démarrer la partie/ }).click();
    await expect(page).toHaveURL(/\/game$/);
    await expect.poll(async () => (await savedGame(page))?.modeState).toMatchObject(item.expected);
    const game = (await savedGame(page))!;
    expect(game.players).toHaveLength(item.family === "Entraînement" ? 1 : 2);
    if (newClassic) {
      await page.getByRole("button", { name: "Triple", exact: true }).click();
      await page.getByRole("button", { name: "Triple 20", exact: true }).click();
      await expect.poll(async () => {
        const saved = await savedGame(page);
        return saved?.modeState.kind === "x01" ? saved.modeState.players[game.players[0]!.id]?.score : undefined;
      }).toBe(Number(item.variant) - 60);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Joueur 1", exact: true })).toBeVisible();
      await expect(page.locator("main > header")).toContainText(item.variant!);
      await expect(page.getByLabel("Fléchettes du tour", { exact: true })).toContainText("60");
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test("sépare les modes des variantes et conserve les choix en changeant de mode", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/new-game");
  await page.getByRole("combobox", { name: "Mode de jeu", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText(["Classique", "Cricket", "Count-Up", "Around the Clock", "Shanghai", "Killer", "Entraînement"]);
  await page.getByRole("option", { name: "Classique", exact: true }).click();
  await choose(page, /^Variante/, "701");
  await choose(page, "Mode de jeu", "Cricket");
  await choose(page, /^Variante/, "Hidden Cricket");
  await expect(page.locator("main section").first().getByRole("combobox", { name: /^Variante/ })).toBeVisible();
  await expect(page.locator("main section").nth(1).getByRole("combobox", { name: /^Variante/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("cricket-selection-mobile.png"), fullPage: true });
  await choose(page, "Mode de jeu", "Classique");
  await expect(page.getByRole("combobox", { name: /^Variante/ })).toContainText("701");
  await choose(page, "Mode de jeu", "Entraînement");
  await choose(page, /^Variante/, "Triples");
  await expect(page.getByRole("button", { name: "Ajouter un joueur" })).toBeDisabled();
  await choose(page, "Mode de jeu", "Killer");
  await expect(page.getByRole("combobox", { name: /^Variante/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Démarrer la partie/ })).toBeEnabled();
  await choose(page, "Mode de jeu", "Entraînement");
  await expect(page.getByRole("combobox", { name: /^Variante/ })).toContainText("Triples");
  await choose(page, "Mode de jeu", "Cricket");
  await expect(page.getByRole("combobox", { name: /^Variante/ })).toContainText("Hidden Cricket");
  await choose(page, "Nombre de manches", "Infini — jusqu’à la victoire");
  await choose(page, "Mode de jeu", "Shanghai");
  await expect(page.getByRole("combobox", { name: /^Variante/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Nombre de manches" })).toContainText("7 manches");
  await expect(page.getByRole("button", { name: /Démarrer la partie/ })).toBeEnabled();
});
