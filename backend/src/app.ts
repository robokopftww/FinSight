import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { clerkPlugin } from "@clerk/fastify";

import { env } from "./config/env.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerPlaidRoutes } from "./modules/plaid/routes.js";
import { registerRoutes } from "./routes/index.js";

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
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
