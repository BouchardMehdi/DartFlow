import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", use: { baseURL: "http://localhost:3000", ...devices["iPhone 13"] }, webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true } });
