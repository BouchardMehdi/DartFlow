import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default("postgres://dartflow:dartflow@localhost:5432/dartflow"),
  JWT_SECRET: z.string().min(32).default("development-only-change-me-please-32chars"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
});

export const config = schema.parse(process.env);
