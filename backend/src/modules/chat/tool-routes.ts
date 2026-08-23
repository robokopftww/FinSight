import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyAdvisorToolJwt } from "../../lib/advisor-tool-jwt.js";
import { getRecentTransactionsForUser, transactionQuerySchema } from "../../lib/advisor-tools.js";

const bodySchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()).default({}),
  userId: z.string(),
});

export async function registerAdvisorToolRoutes(app: FastifyInstance) {
  app.post("/internal/advisor/tool", async (request, reply) => {
    const header = request.headers.authorization ?? "";
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return reply.code(401).send({ error: "missing bearer token" });
    let claims: { userId: string };
    try {
      claims = verifyAdvisorToolJwt(match[1]);
    } catch {
      return reply.code(401).send({ error: "invalid advisor tool token" });
    }
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", details: parsed.error.format() });
    }
    if (parsed.data.userId !== claims.userId) {
      return reply.code(403).send({ error: "userId mismatch" });
    }
    try {
      switch (parsed.data.tool) {
        case "getTransactions": {
          const argsResult = transactionQuerySchema.safeParse(parsed.data.args);
          if (!argsResult.success) {
            return reply
              .code(400)
              .send({ error: "invalid args", details: argsResult.error.format() });
          }
          const data = await getRecentTransactionsForUser(claims.userId, argsResult.data);
          return reply.send({ data });
        }
        default:
          return reply.code(400).send({ error: `unknown tool: ${parsed.data.tool}` });
      }
    } catch (err) {
      request.log.error({ err }, "advisor tool failed");
      return reply.code(500).send({ error: "tool execution failed" });
    }
  });
}
