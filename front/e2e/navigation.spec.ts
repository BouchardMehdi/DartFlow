import { expect, test } from "@playwright/test";

test("permet de naviguer entre les pages depuis le menu mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Navigation mobile",
  });
  await expect(navigation.getByRole("link", { name: "Accueil" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Jouer" })).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Historique" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Statistiques" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Classement" }),
  ).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Clubs" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Compte" })).toBeVisible();

  await navigation.getByRole("link", { name: "Statistiques" }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(
    page.getByRole("heading", { name: "Statistiques par mode" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Classement" })
    .click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(
    page.getByRole("heading", { name: "Classement en ligne" }),
  ).toBeVisible();
});
