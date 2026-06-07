import Fastify from "fastify";
import cors from "@fastify/cors";
import type { OriginFunction } from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { getAuth } from "@clerk/fastify";
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

  // Global rate limit. Keyed per Clerk user when authenticated, else per IP.
  // Registered after Clerk so getAuth can resolve the user. Per-route overrides
  // (e.g. the LLM-backed advisor/report routes) tighten this further.
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      if (env.CLERK_SECRET_KEY) {
        try {
          const auth = getAuth(request);
          if (auth.userId) {
            return `user:${auth.userId}`;
          }
        } catch {
          // getAuth can throw if Clerk has not processed the request yet.
        }
      }
      return request.ip;
    },
  });

  await registerAuthRoutes(app);
  await registerPlaidRoutes(app);
  await registerRoutes(app);

  return app;
}

function buildCorsOrigin(): OriginFunction {
  const configuredOrigin = env.FRONTEND_URL.replace(/\/$/, "");
  const extraOrigins = (env.CORS_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const allowedOrigins = new Set([env.FRONTEND_URL, configuredOrigin, ...extraOrigins]);
  const originRegex = new RegExp(env.CORS_ORIGIN_REGEX);

  return (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    callback(null, allowedOrigins.has(normalizedOrigin) || originRegex.test(normalizedOrigin));
  };
}
