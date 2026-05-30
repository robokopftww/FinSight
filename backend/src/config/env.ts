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
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
});

export const env = envSchema.parse(process.env);
