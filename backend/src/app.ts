import Fastify from "fastify";
import cors from "@fastify/cors";
import type { OriginFunction } from "@fastify/cors";
import helmet from "@fastify/helmet";
import { clerkPlugin } from "@clerk/fastify";

import { env } from "./config/env.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerPlaidRoutes } from "./modules/plaid/routes.js";
import { registerRoutes } from "./routes/index.js";

const allowedMethods = ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"];
const allowedHeaders = ["Authorization", "Content-Type"];

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: buildCorsOrigin(),
    credentials: true,
    methods: allowedMethods,
    allowedHeaders,
  });
  await app.register(helmet);

  if (env.CLERK_SECRET_KEY) {
    await app.register(clerkPlugin, {
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    });
  }

  await registerAuthRoutes(app);
  await registerPlaidRoutes(app);
  await registerRoutes(app);

  return app;
}

function buildCorsOrigin(): OriginFunction {
  const configuredOrigin = env.FRONTEND_URL.replace(/\/$/, "");
  const allowedOrigins = new Set([env.FRONTEND_URL, configuredOrigin]);

  return (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, "");
    const isAllowedVercelDeployment = /^https:\/\/fin-sight-frontend-[a-z0-9-]+\.vercel\.app$/.test(normalizedOrigin);

    callback(null, allowedOrigins.has(normalizedOrigin) || isAllowedVercelDeployment);
  };
}
