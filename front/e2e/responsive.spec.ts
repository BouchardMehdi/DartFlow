import { expect, test, type Page } from "@playwright/test";
import { createCountUpGame } from "../src/game-engine/count-up";
import { createKillerGame } from "../src/game-engine/killer";

test.use({ serviceWorkers: "block" });
test.describe.configure({ mode: "parallel" });

const now = "2026-10-22T12:00:00.000Z";
const username = "un_pseudo_de_24_caracteres".slice(0, 24);
const players = Array.from({ length: 8 }, (_, order) => ({ id: crypto.randomUUID(), name: `${"JoueurSansEspace".repeat(2)}${order}`, order, ownerUserId: "user", ownerUsername: username }));
const game = createCountUpGame(players);
const club = { id: "demo", name: "UnClubAvecUnNomTresLongSansEspacePourLeMobile", slug: "demo", description: "Description du club ".repeat(8), visibility: "public", role: "owner", membershipStatus: "active", memberCount: 8, profileCount: 8, createdAt: now, inviteCode: "DF-ABC123456789" };
const profiles = players.map(player => ({ ...player, hasCustomAvatar: true, canManage: true, kind: "personal" }));
const members = players.map((player, index) => ({ userId: index ? player.id : "user", username, role: index ? "member" : "owner", status: index === 7 ? "pending" : "active", joinedAt: now }));
const detail = { club, profiles, members, availableProfiles: profiles };
const entries = players.map(player => ({ profileId: player.id, name: player.name, seed: player.order + 1, played: 12, wins: 8, losses: 4, points: 24 }));
const tournament = { id: "cup", clubId: "demo", name: club.name, format: "round-robin", modeKey: "501", status: "active", createdByUsername: username, entries, matches: [{ id: "match", round: 1, position: 1, profileA: players[0], profileB: players[1], status: "scheduled" }], createdAt: now, updatedAt: now };
const rows = players.map(player => ({ rank: player.order + 1, profileId: player.id, name: player.name, ownerUsername: username, kind: "personal", games: 12, wins: 8, losses: 4, winRate: 66.7, dartsThrown: 300, turnsPlayed: 100, pointsScored: 6000, averagePerDart: 20, averagePerTurn: 60, bestTurn: 180, scores100Plus: 4, scores140Plus: 2, scores180: 1, doublesHit: 12, triplesHit: 20, bullsHit: 8, highestCheckout: 120, favoriteSector: 20, recentForm: [{ date: now, averagePerDart: 20 }] }));
const room = { id: "room", clubId: "demo", clubName: club.name, name: club.name, status: "playing", hostUserId: "user", hostUsername: username, scorerUserId: "user", scorerUsername: username, gameState: game, gameVersion: 123, viewerCount: 8, createdAt: now, updatedAt: now };

async function mockApi(page: Page) {
  // These layout tests mock the API; prevent the PWA worker from caching or
  // bypassing those mocks, without changing the application's PWA behavior.
  await page.addInitScript(() => {
    delete (Navigator.prototype as { serviceWorker?: ServiceWorkerContainer }).serviceWorker;
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.slice(4);
    let json: unknown;
    if (path === "/auth/me") json = { user: { id: "user", username, email: `${"emailtreslong".repeat(5)}@example.test`, createdAt: now }, accessExpiresAt: "2099-01-01T00:00:00Z" };
    else if (path === "/sync") json = { profiles: [], games: [], profileIdMappings: {}, syncedAt: now };
    else if (path === "/friends") json = { friends: [{ userId: "friend", username, since: now }], requests: [{ userId: "request", username, direction: "incoming", createdAt: now }] };
    else if (path.includes("/shares")) json = { shares: [{ userId: "friend", username, role: "player" }] };
    else if (path === "/leaderboard") json = { rows };
    else if (path === "/notifications") json = { unreadCount: 1, notifications: [{ id: "notice", type: "club", title: club.name, body: club.description, createdAt: now }] };
    else if (path === "/clubs") json = { clubs: [club], discover: [club] };
    else if (path.endsWith("/statistics")) json = { club, selectedMode: "all", modes: [{ key: "501", label: "501" }], leaderboard: rows };
    else if (path.endsWith("/messages")) json = { club, messages: [{ id: "message", clubId: "demo", authorUserId: "user", authorUsername: username, content: "Un long message à lire sur mobile. ".repeat(27), createdAt: now, canModify: true, reactions: [] }], authorAvatars: {} };
    else if (path.endsWith("/rooms")) json = { rooms: [room] };
    else if (path.endsWith("/rooms/room")) json = room;
    else if (path.endsWith("/tournaments")) json = { tournaments: [tournament] };
    else if (path.endsWith("/tournaments/cup")) json = tournament;
    else if (path === "/clubs/demo") json = detail;
    else json = {};
    await route.fulfill({ json });
  });
  await page.routeWebSocket(/realtime/, socket => socket.onMessage(() => {}));
}

async function seed(page: Page, state = game) {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Compte de/ })).toBeVisible();
  await page.evaluate(async ({ state, players, now }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("dartflow");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["games", "players"], "readwrite");
        for (const player of players) tx.objectStore("players").put({ ...player, createdAt: now, updatedAt: now });
        tx.objectStore("games").put({ ...state, savedAt: "2099-01-01T00:00:00Z" });
        tx.objectStore("games").put({ ...state, id: "completed", status: "completed", completedAt: now, winnerId: players[0]!.id, savedAt: now });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { state, players, now });
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    outside: [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== "absolute"; }).map(el => el.tagName + ":" + String(el.className)).slice(0, 5),
  })), { message: page.url() }).toMatchObject({ overflow: 0 }).catch(async error => {
    console.log(await page.evaluate(() => [...document.querySelectorAll("body *")].map(el=>({tag:el.tagName,cls:String(el.className),x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,scroll:el.scrollWidth,client:el.clientWidth})).filter(el=>el.right>innerWidth+1||el.x< -1)));
    throw error;
  });
}

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 640, height: 800 }, { width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`pages remplies sans débordement à ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => {
      // WebKit reports cancelled mocked fetches as access-control errors when
      // moving to the next page. Keep genuine application exceptions visible.
      if (!/^\/localhost:3000\/api\/[\w/]+ due to access control checks\.$/.test(error.message)) errors.push(error.message);
    });
    await mockApi(page);
    await seed(page);
    for (const path of ["/", "/new-game", "/history", "/stats", "/leaderboard", "/account", "/notifications", "/clubs", "/clubs/demo", "/clubs/demo/stats", "/clubs/demo/tournaments", "/clubs/demo/tournaments/cup", "/clubs/demo/live", "/clubs/demo/live/room", "/clubs/demo/chat", "/game"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText(/^(Chargement|Connexion au salon|Restauration de la partie)/)).toHaveCount(0);
      if (["/clubs", "/clubs/demo/tournaments", "/clubs/demo/live"].includes(path)) await expect(page.getByRole("link").filter({ hasText: club.name }).first()).toBeVisible();
      if (path === "/account") await expect(page.getByText(players[0]!.name, { exact: true })).toBeVisible();
      await expectNoOverflow(page);
      if (["/game", "/clubs/demo/tournaments/cup", "/clubs/demo/stats"].includes(path)) await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll("/", "-")}.png`), fullPage: true, animations: "disabled" });
    }
    if (viewport.width < 1024) {
      await page.goto("/");
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeInViewport();
      await expectNoOverflow(page);
    }
    expect(errors).toEqual([]);
  });
}

test("saisie mobile précise, annulation et cible sans lancer pendant un glissement", async ({ page }) => {
  await mockApi(page);
  await seed(page);
  await page.goto("/game");
  const darts = page.getByLabel("Fléchettes du tour", { exact: true });
  await page.getByRole("button", { name: "Triple", exact: true }).click();
  await page.getByRole("button", { name: "Triple 20", exact: true }).click();
  await expect(darts).toContainText("60");
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(darts).toContainText("D1");
  await page.getByRole("button", { name: "Bull · 25" }).click();
  await page.getByRole("button", { name: "Bull · 50" }).click();
  await expect(darts).toContainText("25");
  await expect(darts).toContainText("50");
  await page.getByRole("button", { name: "Cible", exact: true }).click();
  const bull = page.getByRole("button", { name: "Double bull, 50 points" });
  await bull.dispatchEvent("pointerdown", { clientX: 150, clientY: 350 });
  await bull.dispatchEvent("pointermove", { clientX: 150, clientY: 390 });
  await bull.dispatchEvent("click", { detail: 1 });
  await expect(darts).toContainText("D3");
  await bull.dispatchEvent("pointerdown", { clientX: 150, clientY: 350 });
  await bull.dispatchEvent("pointercancel");
  await bull.dispatchEvent("click", { detail: 1 });
  await expect(darts).toContainText("D3");
  await bull.tap();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(players[1]!.name);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(players[1]!.name);
});

test("formulaires de connexion et de récupération sur petit téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockApi(page);
  await page.route("**/api/auth/**", route => route.fulfill({ status: 401, json: { message: "Non connecté" } }));
  for (const path of ["/login", "/register", "/forgot-password", "/~offline"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoOverflow(page);
  }
});

test("Killer à cinq vies et actions d'un long message sur petit écran", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockApi(page);
  await seed(page, createKillerGame(players, 5));
  await page.goto("/game");
  await expect(page.getByLabel("État des joueurs Killer").locator("article")).toHaveCount(8);
  await expectNoOverflow(page);
  await page.goto("/clubs/demo/chat");
  const message = page.getByRole("button", { name: "Maintenir appuyé pour gérer ce message" });
  await message.press("Enter");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toBeVisible();
  await expectNoOverflow(page);
});
