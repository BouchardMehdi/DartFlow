import { createServer, request, type Server } from "node:http";
import { expect, test } from "@playwright/test";

// Proxy the built application to simulate successive deployments of its real worker.
// A separate origin keeps these registrations isolated from the other browser tests.
test.use({ browserName: "chromium", serviceWorkers: "allow", viewport: { width: 320, height: 740 } });
test.describe.configure({ mode: "serial" });
let server: Server;
let origin: string;
let version = 1;

test.beforeAll(async () => {
  server = createServer((incoming, outgoing) => {
    if (incoming.url?.startsWith("/api/")) {
      outgoing.writeHead(401, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ message: "Non connecté" }));
      return;
    }
    const deployment = version;
    const upstream = request(`http://localhost:3000${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers: { ...incoming.headers, host: "localhost:3000", "accept-encoding": "identity" },
    }, response => {
      if (incoming.url?.split("?")[0] === "/serwist/sw.js") {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          // Refresh only the HTML revisions, leaving the real Serwist lifecycle intact.
          const worker = Buffer.concat(chunks).toString().replace(
            /((?:"url"|url):\s*"\/(?:~offline)?",\s*(?:"revision"|revision):\s*")[^"]+/g,
            `$1pwa-test-${deployment}`,
          );
          outgoing.writeHead(response.statusCode ?? 500, {
            "Content-Type": "text/javascript",
            "Service-Worker-Allowed": "/",
            "Cache-Control": "no-store",
          });
          outgoing.end(`${worker}\n// Test deployment ${deployment}\n`);
        });
      } else {
        outgoing.writeHead(response.statusCode ?? 500, { ...response.headers, "x-test-deployment": String(deployment) });
        response.pipe(outgoing);
      }
    });
    upstream.on("error", () => { outgoing.writeHead(502); outgoing.end(); });
    incoming.pipe(upstream);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("attend l’accord, affiche un message adapté au mobile et charge la nouvelle version", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    sessionStorage.setItem("pwa-test-loads", String(Number(sessionStorage.getItem("pwa-test-loads")) + 1));
  });
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  const notice = page.getByRole("complementary", { name: "Mise à jour de l’application" });
  await expect(notice).toHaveCount(0);
  const loads = () => page.evaluate(() => Number(sessionStorage.getItem("pwa-test-loads")));
  const initialLoads = await loads();
  version++;
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  await expect(notice).toBeVisible();
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true);
  expect(await loads()).toBe(initialLoads);
  await expect(notice.getByRole("button", { name: "Actualiser" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("mise-a-jour-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Plus tard" }).click();
  await expect(notice).toHaveCount(0);
  expect(await loads()).toBe(initialLoads);

  // A later deployment is offered again, even if the previous one was dismissed.
  version++;
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  await expect(notice).toBeVisible();
  const navigation = page.waitForNavigation();
  await notice.getByRole("button", { name: "Actualiser" }).click();
  const response = await navigation;
  expect(response?.headers()["x-test-deployment"]).toBe(String(version));
  await expect(notice).toHaveCount(0);
  expect(await loads()).toBe(initialLoads + 1);
});

test("laisse terminer la saisie et conserve les scores après actualisation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`${origin}/new-game`);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByRole("button", { name: /Démarrer la partie/ }).click();
  await expect(page).toHaveURL(`${origin}/game`);
  await page.getByRole("button", { name: "Simple 20", exact: true }).click();
  version++;
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true);
  const notice = page.getByRole("complementary", { name: "Mise à jour de l’application" });
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: "Simple 5", exact: true }).click();
  await expect(page.getByLabel("Fléchettes du tour", { exact: true })).toContainText("20");
  await expect(page.getByLabel("Fléchettes du tour", { exact: true })).toContainText("5");
  // Client navigation preserves the current game and the pending update notice.
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/new-game`);
  await expect(notice).toBeVisible();
  const navigation = page.waitForNavigation();
  await notice.getByRole("button", { name: "Actualiser" }).click();
  await navigation;
  await page.getByRole("link", { name: /DARTFLOW/ }).click();
  await page.getByRole("button", { name: /Reprendre la partie/ }).click();
  await expect(page.getByLabel("Fléchettes du tour", { exact: true })).toContainText("20");
  await expect(page.getByLabel("Fléchettes du tour", { exact: true })).toContainText("5");
});
