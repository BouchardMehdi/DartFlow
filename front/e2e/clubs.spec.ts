import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

test("crée un club, un profil invité et prépare une partie du club", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const suffix = Date.now();
  const username = `club_${suffix}`;
  const clubName = `Les Fléchettes ${suffix}`;

  await page.goto("/register");
  await page.getByLabel("Nom d’utilisateur public").fill(username);
  await page.getByLabel("Adresse email").fill(`${username}@example.test`);
  await page.getByLabel("Mot de passe").fill("Test-DartFlow-42!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("button", { name: "J’ai sauvegardé mon code" }).click();
  await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();
  const realtimeReady = await page.evaluate(() => new Promise<boolean>((resolve) => {
      const socket = new WebSocket(`ws://${window.location.hostname}:4000/realtime`);
      const timeout = window.setTimeout(() => { socket.close(); resolve(false); }, 4_000);
      socket.addEventListener("message", (event) => {
        if ((JSON.parse(String(event.data)) as { type?: string }).type !== "ready") return;
        window.clearTimeout(timeout); socket.close(); resolve(true);
      });
      socket.addEventListener("error", () => { window.clearTimeout(timeout); resolve(false); });
    }));
  expect(realtimeReady).toBe(true);

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

  const avatar = {
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwVQAAAAAElFTkSuQmCC", "base64"),
  };
  await page.getByLabel("Choisir la photo du club").setInputFiles(avatar);
  await expect(page.getByText("Photo du club mise à jour.")).toBeVisible();
  await expect(page.getByAltText(`Photo du club ${clubName}`)).toBeVisible();

  await page.getByPlaceholder("Pseudo de l’invité").fill("Joueur invité");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Profil invité créé.")).toBeVisible();
  await expect(page.getByText("Joueur invité", { exact: true })).toBeVisible();
  await page.getByLabel("Choisir la photo de Joueur invité").setInputFiles(avatar);
  await expect(page.getByText("Photo du profil mise à jour.")).toBeVisible();
  await expect(page.getByAltText("Photo de Joueur invité")).toBeVisible();
  await page.getByPlaceholder("Pseudo de l’invité").fill("Deuxième joueur");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Deuxième joueur", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Pseudo de l’invité").fill("Troisième joueur");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Troisième joueur", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Ouvrir le chat du club" }).click();
  await expect(page).toHaveURL(/\/clubs\/[^/]+\/chat$/);
  await page.getByLabel("Écrire un message").fill("Bienvenue dans le club !");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const firstMessage = page.getByText("Bienvenue dans le club !", { exact: true });
  await expect(firstMessage).toBeVisible();
  const firstMessageButton = page.getByRole("button", {
    name: "Maintenir appuyé pour gérer ce message",
  });
  await firstMessageButton.dispatchEvent("touchstart");
  await page.waitForTimeout(650);
  await firstMessageButton.dispatchEvent("touchend");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Modifier le message" })
    .fill("Bienvenue au club !");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  const editedMessage = page
    .getByRole("region", { name: "Messages du club" })
    .getByText("Bienvenue au club !", { exact: true });
  await expect(editedMessage).toBeVisible();
  await expect(page.getByText("· modifié", { exact: true })).toBeVisible();
  await firstMessageButton.dispatchEvent("touchstart");
  await page.waitForTimeout(650);
  await firstMessageButton.dispatchEvent("touchend");
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(editedMessage).toHaveCount(0);
  await expect(page.getByText("Commence la conversation")).toBeVisible();
  await page.getByRole("link", { name: "Retour", exact: true }).click();

  await page.getByRole("link", { name: /Salons en direct/ }).click();
  await expect(page.getByRole("heading", { name: "Salons en direct" })).toBeVisible();
  await page.getByLabel("Nom").fill("Finale du vendredi");
  await page.getByRole("button", { name: "Créer le salon" }).click();
  await expect(page).toHaveURL(/\/clubs\/[^/]+\/live\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Finale du vendredi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurer la partie" })).toBeVisible();
  await page.getByRole("link", { name: "Salons en direct" }).click();
  await page.getByRole("link", { name: "Retour au club" }).click();

  await page.getByRole("link", { name: /Tournois et championnats/ }).click();
  await expect(page.getByRole("heading", { name: "Tournois et championnats" })).toBeVisible();
  await page.getByLabel("Nom").fill("Championnat E2E");
  await page.getByLabel("Format du tournoi").click();
  await page.getByRole("option", { name: "Élimination directe" }).click();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page).toHaveURL(/\/clubs\/[^/]+\/tournaments\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Championnat E2E" })).toBeVisible();
  await expect(page.getByText("Joueur invité", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Deuxième joueur", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Troisième joueur", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("En cours", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Toutes les compétitions" }).click();
  await page.getByRole("link", { name: "Retour au club" }).click();

  await page.getByRole("link", { name: "Voir le classement et les statistiques du club" }).click();
  await expect(page).toHaveURL(/\/clubs\/[^/]+\/stats$/);
  await expect(page.getByRole("heading", { name: "Tous les joueurs" })).toBeVisible();
  await expect(page.getByText("Joueur invité", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Filtrer par mode de jeu")).toContainText("Tous les modes");
  await page.getByRole("link", { name: "Retour au club" }).click();

  await page.getByRole("link", { name: "Jouer dans ce club →" }).click();
  await expect(page).toHaveURL(/\/new-game\?club=/);
  await expect(page.getByText("Partie du club")).toBeVisible();
  await expect(page.getByText(clubName, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Profil du joueur 1")).toContainText("Deuxième joueur");
  await expect(page.getByLabel("Profil du joueur 2")).toContainText("Joueur invité");
});
