import { clerkClient, getAuth } from "@clerk/fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

export async function requireAppUser(request: FastifyRequest, reply: FastifyReply) {
  if (!env.CLERK_SECRET_KEY) {
    reply.status(501).send({ error: "Clerk is not configured" });
    return null;
  }

  const auth = getAuth(request);

  if (!auth.userId) {
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
  });

  if (existingUser) {
    return existingUser;
  }

  const clerkUser = await clerkClient.users.getUser(auth.userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    reply.status(422).send({ error: "Authenticated user has no email address" });
    return null;
  }

  // Upsert (not create) so concurrent first-time requests for the same user
  // do not race into a unique-constraint violation. Authed pages fan out
  // multiple parallel API calls, so this path is hit concurrently.
  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    create: {
      clerkId: clerkUser.id,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    },
    update: {},
  });
}
