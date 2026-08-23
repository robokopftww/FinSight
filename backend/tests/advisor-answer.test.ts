import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/routes/index.js";

process.env.ADVISOR_TOOL_SECRET =
  process.env.ADVISOR_TOOL_SECRET ??
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.AI_SERVICE_URL = "http://ai-service.local";

vi.mock("../src/lib/auth.js", () => ({
  requireAppUser: vi.fn().mockResolvedValue({
    id: "u_test",
    clerkId: "clerk_test",
    email: "test@example.com",
  }),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    chatHistory: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
    plaidItem: { count: vi.fn(async () => 0) },
  },
}));

const fetchMock = vi.spyOn(globalThis, "fetch");

async function buildApp() {
  const fastify = Fastify();
  await registerRoutes(fastify);
  return fastify;
}

describe("POST /api/advisor/answer", () => {
  it("forwards to ai-service and echoes payload", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          answer: "Aim for 3–6 months of expenses [1].",
          sources: [{ n: 1, title: "CFPB", publisher: "CFPB", url: "https://cfpb.gov/x", snippet: "…" }],
          toolTrace: [{ name: "searchDocs", input: { query: "emergency fund" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const app = await buildApp();
    const resp = await app.inject({
      method: "POST",
      url: "/api/advisor/answer",
      payload: { question: "How big should my emergency fund be?", sessionId: "s_1" },
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.json();
    expect(body.answer).toContain("3–6 months");
    expect(body.sources).toHaveLength(1);
  });

  it("returns 502 when the ai-service upstream call fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const app = await buildApp();
    const resp = await app.inject({
      method: "POST",
      url: "/api/advisor/answer",
      payload: { question: "What should I do?" },
    });
    expect(resp.statusCode).toBe(502);
  });

  it("returns 400 for an invalid body", async () => {
    const app = await buildApp();
    const resp = await app.inject({
      method: "POST",
      url: "/api/advisor/answer",
      payload: { question: "" },
    });
    expect(resp.statusCode).toBe(400);
  });
});
