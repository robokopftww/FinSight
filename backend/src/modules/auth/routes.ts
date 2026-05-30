import { clerkClient, getAuth } from "@clerk/fastify";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

const syncUserSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/sync-user", async (request, reply) => {
    const payload = syncUserSchema.parse(request.body);

    if (env.CLERK_SECRET_KEY) {
      const auth = getAuth(request);

      if (!auth.userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      if (auth.userId !== payload.clerkId) {
        return reply.status(403).send({ error: "Authenticated user does not match payload" });
      }
    } else if (env.NODE_ENV === "production") {
      return reply.status(500).send({ error: "CLERK_SECRET_KEY is required in production" });
    }

    const user = await prisma.user.upsert({
      where: { clerkId: payload.clerkId },
      create: {
        clerkId: payload.clerkId,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
      update: {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    });

    return reply.send({ user });
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!env.CLERK_SECRET_KEY) {
      return reply.status(501).send({ error: "Clerk is not configured" });
    }

    const auth = getAuth(request);

    if (!auth.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    return reply.send({
      clerkUser: {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
      user,
    });
  });
}
