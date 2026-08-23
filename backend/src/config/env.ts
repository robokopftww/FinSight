import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/finsight"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  AI_SERVICE_URL: z.string().default("http://127.0.0.1:8000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  // Comma-separated extra origins allowed by CORS (e.g. preview deployments).
  CORS_EXTRA_ORIGINS: z.string().optional(),
  // Regex matched against the request origin to allow dynamic preview URLs.
  // Defaults to the Vercel project naming pattern.
  CORS_ORIGIN_REGEX: z.string().default("^https://fin-sight-frontend-[a-z0-9-]+\\.vercel\\.app$"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  ADVISOR_TOOL_SECRET: z
    .string()
    .min(32)
    .default("0000000000000000000000000000000000000000000000000000000000000000"),
});

export const env = envSchema.parse(process.env);
