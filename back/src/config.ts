import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_HOST: z.string().min(1).default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_DB: z.string().min(1).default("dartflow"),
  POSTGRES_USER: z.string().min(1).default("dartflow"),
  POSTGRES_PASSWORD: z.string().min(1).default("dartflow"),
  JWT_SECRET: z.string().min(32).default("development-only-change-me-please-32chars"),
  FRONTEND_ORIGIN: z.url().default("http://localhost:3000"),
  ACCESS_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(4),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
});

const parsed = schema.superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return;
  if (values.JWT_SECRET === "development-only-change-me-please-32chars" || values.JWT_SECRET.includes("CHANGE_ME")) {
    context.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "JWT_SECRET doit etre remplace en production." });
  }
  if (!values.DATABASE_URL && values.POSTGRES_PASSWORD.includes("CHANGE_ME")) {
    context.addIssue({ code: "custom", path: ["POSTGRES_PASSWORD"], message: "POSTGRES_PASSWORD doit etre remplace en production." });
  }
}).parse(process.env);
export const config = { ...parsed, COOKIE_SECURE: parsed.COOKIE_SECURE === undefined ? parsed.NODE_ENV === "production" : parsed.COOKIE_SECURE === "true" };
