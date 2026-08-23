import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "../../config/env.js";
import { signAdvisorToolJwt } from "../../lib/advisor-tool-jwt.js";
import { requireAppUser } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";

const bodySchema = z.object({
  question: z.string().min(1),
  sessionId: z.string().min(1).default("default"),
});

export async function registerAdvisorAnswerRoutes(app: FastifyInstance) {
  app.post("/api/advisor/answer", async (request, reply) => {
    const user = await requireAppUser(request, reply);
    if (!user) {
      return reply;
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", details: parsed.error.format() });
    }
    const { question, sessionId } = parsed.data;

    const history = await prisma.chatHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, message: true },
    });

    const plaidReady = (await prisma.plaidItem.count({ where: { userId: user.id } })) > 0;
    const toolContext = { userId: user.id, plaidReady, now: new Date().toISOString() };

    await prisma.chatHistory.create({ data: { userId: user.id, role: "user", message: question } });

    const jwt = signAdvisorToolJwt({ userId: user.id, ttlSeconds: 120 });
    const upstream = await fetch(`${env.AI_SERVICE_URL}/rag/answer`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tool-jwt": jwt },
      body: JSON.stringify({ question, toolContext, history }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      request.log.error({ upstreamStatus: upstream.status, text }, "ai-service failure");
      return reply.code(502).send({ error: "advisor upstream failed" });
    }

    const payload = (await upstream.json()) as {
      answer: string;
      sources: unknown[];
      toolTrace: unknown[];
    };

    await prisma.chatHistory.create({
      data: {
        userId: user.id,
        role: "assistant",
        message: payload.answer,
        contextSnapshot: { sources: payload.sources, tools: payload.toolTrace } as Prisma.InputJsonValue,
      },
    });

    return reply.send({ ...payload, sessionId });
  });
}
