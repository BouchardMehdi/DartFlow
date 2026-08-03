import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

test("crée un compte depuis les boutons visibles de l'accueil", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  const suffix = Date.now();
  const username = `e2e_${suffix}`;
  const email = `${username}@example.test`;
  const initialPassword = "Test-DartFlow-42!";
  const newPassword = "Nouveau-DartFlow-84!";
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Créer un compte", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Nom d’utilisateur public").fill(username);
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(initialPassword);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Sauvegarde ton code" })).toBeVisible();
  const recoveryCode = (await page.getByTestId("recovery-code").textContent()) ?? "";
  expect(recoveryCode).toMatch(/^DF-/);
  await page.getByRole("button", { name: "J’ai sauvegardé mon code" }).click();
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

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/login");
  await otherPage.getByLabel("Adresse email").fill(email);
  await otherPage.getByLabel("Mot de passe").fill(initialPassword);
  await otherPage.getByRole("button", { name: "Se connecter" }).click();
  await expect(otherPage.getByRole("heading", { name: `@${username}` })).toBeVisible();

  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page.getByRole("heading", { name: "Connecte-toi à DartFlow" })).toBeVisible();
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: "Créer le nouveau mot de passe" })).toBeEnabled();
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Code de récupération").fill(recoveryCode);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
  await page.getByLabel("Nom d’utilisateur", { exact: true }).fill(username);
  await expect(page.getByLabel("Nom d’utilisateur", { exact: true })).toHaveValue(username);
  await expect(page.locator("form input:invalid")).toHaveCount(0);
  await page.getByRole("button", { name: "Créer le nouveau mot de passe" }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe modifié" })).toBeVisible();

  await otherPage.goto("/account");
  await expect(otherPage.getByRole("heading", { name: "Connecte-toi à DartFlow" })).toBeVisible();
  await otherContext.close();

  await page.getByRole("link", { name: "Se connecter" }).click();
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(newPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();
  await page.getByRole("link", { name: "Ouvrir mon compte" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Générer un nouveau code" }).click();
  await expect(page.getByTestId("account-recovery-code")).toContainText("DF-");
});
