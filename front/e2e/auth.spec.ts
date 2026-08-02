import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

test("crée un compte depuis les boutons visibles de l'accueil", async ({
  page,
}) => {
  const suffix = Date.now();
  const username = `e2e_${suffix}`;
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Créer un compte", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Nom d’utilisateur public").fill(username);
  await page.getByLabel("Adresse email").fill(`${username}@example.test`);
  await page.getByLabel("Mot de passe").fill("Test-DartFlow-42!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(
    page.getByRole("heading", { name: `@${username}` }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).not.toContain("dartflow_");
  await page.getByRole("link", { name: "Ouvrir mon compte" }).click();

  await page.getByLabel("Choisir une photo de profil").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwVQAAAAAElFTkSuQmCC",
      "base64",
    ),
  });
  await expect(page.getByText("Photo de profil mise à jour.")).toBeVisible();
  await expect(
    page.locator("header").getByAltText(`Photo de ${username}`),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator("header").getByAltText(`Photo de ${username}`),
  ).toBeVisible();
});
