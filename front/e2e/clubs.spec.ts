import { expect, test } from "@playwright/test";

test("crée un club, un profil invité et prépare une partie du club", async ({
  page,
}) => {
  const suffix = Date.now();
  const username = `club_${suffix}`;
  const clubName = `Les Fléchettes ${suffix}`;

  await page.goto("/register");
  await page.getByLabel("Nom d’utilisateur public").fill(username);
  await page.getByLabel("Adresse email").fill(`${username}@example.test`);
  await page.getByLabel("Mot de passe").fill("Test-DartFlow-42!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Clubs" })
    .click();
  await expect(page.getByRole("heading", { name: "Clubs", exact: true })).toBeVisible();

  await page.getByLabel("Nom", { exact: true }).fill(clubName);
  await page.getByLabel("Description").fill("Club créé par le test E2E");
  await page.getByRole("button", { name: "Créer le club" }).click();
  await expect(page.getByRole("heading", { name: clubName })).toBeVisible();

  await page.getByPlaceholder("Pseudo de l’invité").fill("Joueur invité");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Profil invité créé.")).toBeVisible();
  await expect(page.getByText("Joueur invité", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Classement et stats" }).click();
  await expect(page).toHaveURL(/\/clubs\/[^/]+\/stats$/);
  await expect(page.getByRole("heading", { name: "Tous les joueurs" })).toBeVisible();
  await expect(page.getByText("Joueur invité", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Filtrer par mode de jeu")).toContainText("Tous les modes");
  await page.getByRole("link", { name: "Retour au club" }).click();

  await page.getByRole("link", { name: "Jouer dans ce club →" }).click();
  await expect(page).toHaveURL(/\/new-game\?club=/);
  await expect(page.getByText("Partie du club")).toBeVisible();
  await expect(page.getByText(clubName, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Profil du joueur 1")).toContainText("Joueur invité");
});
