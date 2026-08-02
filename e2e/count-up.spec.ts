import { expect, test } from "@playwright/test";
test("affiche la démo Count-Up sur mobile", async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: "Joueur 1" })).toBeVisible(); await expect(page.getByRole("group", { name: /cible/i })).toBeVisible(); });
