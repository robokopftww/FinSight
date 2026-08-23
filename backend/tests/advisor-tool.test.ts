import { describe, expect, it, beforeAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/routes/index.js";
import { signAdvisorToolJwt } from "../src/lib/advisor-tool-jwt.js";

let app: Awaited<ReturnType<typeof buildApp>>;

async function buildApp() {
  const fastify = Fastify();
  await registerRoutes(fastify);
  return fastify;
}

beforeAll(async () => {
  app = await buildApp();
});

describe("POST /internal/advisor/tool", () => {
  it("rejects requests without a valid JWT", async () => {
    const resp = await app.inject({
      method: "POST",
      url: "/internal/advisor/tool",
      payload: { tool: "getTransactions", args: {}, userId: "u_1" },
    });
    expect(resp.statusCode).toBe(401);
  });

  it("rejects when JWT userId does not match body userId", async () => {
    const token = signAdvisorToolJwt({ userId: "u_1", ttlSeconds: 60 });
    const resp = await app.inject({
      method: "POST",
      url: "/internal/advisor/tool",
      headers: { authorization: `Bearer ${token}` },
      payload: { tool: "getTransactions", args: {}, userId: "u_2" },
    });
    expect(resp.statusCode).toBe(403);
  });

  it("returns an error payload for an unknown tool", async () => {
    const token = signAdvisorToolJwt({ userId: "u_1", ttlSeconds: 60 });
    const resp = await app.inject({
      method: "POST",
      url: "/internal/advisor/tool",
      headers: { authorization: `Bearer ${token}` },
      payload: { tool: "getSomethingBogus", args: {}, userId: "u_1" },
    });
    expect(resp.statusCode).toBe(400);
    expect(resp.json()).toMatchObject({ error: expect.stringContaining("unknown tool") });
  });
});
