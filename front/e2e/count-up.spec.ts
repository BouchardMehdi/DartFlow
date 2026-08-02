import { expect, test } from "@playwright/test";

test("configure puis démarre un Count-Up sur mobile", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Nouvelle partie" }).click();
  await page.getByLabel("Pseudo du joueur 1").fill("Alice");
  await page.getByLabel("Ordre de passage aléatoire").check();
  await page.getByRole("button", { name: /Démarrer la partie/ }).click();
  await expect(page, `Erreurs navigateur : ${pageErrors.join(" | ")}`).toHaveURL(/\/game$/);
  await expect(page.getByRole("group", { name: /cible/i })).toBeVisible();
  await expect(page.getByText("Alice", { exact: true }).first()).toBeVisible();
});
