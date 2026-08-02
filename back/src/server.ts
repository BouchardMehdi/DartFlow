import { buildApp } from "./app.js";
import { closeDatabase, migrate } from "./database.js";
import { config } from "./config.js";

await migrate();
const app = await buildApp();
const shutdown = async () => { await app.close(); await closeDatabase(); process.exit(0); };
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
await app.listen({ host: config.HOST, port: config.PORT });
