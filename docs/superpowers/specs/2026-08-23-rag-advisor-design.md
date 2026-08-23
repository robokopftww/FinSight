# RAG advisor — design

**Date**: 2026-08-23
**Owner**: keshavtyg
**Status**: draft, awaiting review

## Problem

The advisor chat today calls Gemini with a hand-crafted context object of pre-computed dashboard numbers. There is no knowledge base, no retrieval, and no grounding beyond what the caller already knew. The "Grounded in your data" pill overstates what the system does. We want a real Retrieval-Augmented Generation loop that can answer both personal-money questions and general-finance questions.

## Non-goals

- Multi-user knowledge sharing. The doc corpus is global; personal data is per-user only.
- Fine-tuning. Off-the-shelf Haiku 4.5 is the answerer.
- Multi-modal input. Text only.
- Streaming responses. Non-stream MVP; API shape leaves room for SSE in v2.

## Decisions

| # | Choice | Alternative rejected |
|---|--------|----------------------|
| Q1 | Hybrid corpus: personal data + domain docs | Personal-only, domain-only |
| Q2 | Personal data reached via typed tool functions | Embed transactions, text-to-SQL |
| Q3 | Domain corpus: hybrid gov (public domain) + scraped commercial | Gov-only, scraped-only, skip-corpus |
| Q4 | Vector store: pgvector on existing Postgres | Chroma, Pinecone/Qdrant |
| Q5 | Router: single Anthropic tool-calling agent, all tools registered together | LLM classifier, keyword router, parallel-fetch |
| Q6 | Models: Claude Haiku 4.5 (chat) + OpenAI `text-embedding-3-small` (embed) | GPT-4o mini, Gemini Flash |
| Q7 | Split ownership: backend owns tools, ai-service owns LLM/embed/retrieval | All in ai-service, all in backend |
| Q8 | Inline `[n]` citations | Sources drawer, no citations, both |
| Q9 | Non-stream MVP | SSE from day one |

## Architecture

```
Browser (AdvisorChat)
  └─ POST /api/advisor/answer  {question, sessionId}
       │
       ▼
Backend (Fastify + Prisma + Clerk)
  ├─ verify session, resolve userId
  ├─ compose ToolContext {userId, plaidReady, now}
  ├─ mint short-lived JWT scoped to userId
  └─ POST http://ai-service/rag/answer {question, toolContext, history}
       │
       ▼
AI-service (FastAPI + Anthropic + OpenAI + psycopg)
  ├─ Anthropic Haiku 4.5 tool-calling loop
  ├─ Registered tools:
  │    - searchDocs(query, k)            [local: pgvector, OpenAI embed query]
  │    - getTransactions(...)            [callback → backend]
  │    - getSubscriptions()              [callback → backend]
  │    - getBalance(asOfDate?)           [callback → backend]
  │    - getInsights(severity?)          [callback → backend]
  │    - getForecast(horizonDays)        [callback → backend]
  ├─ Backend callback uses signed JWT (60s TTL, userId claim)
  └─ Return {answer, sources[], toolTrace}

Backend writes user + assistant turns to ChatHistory, returns payload to browser.
```

## Data model

Prisma schema additions:

```prisma
enum KbSource { GOV COMMERCIAL }

model KbDocument {
  id           String     @id @default(cuid())
  source       KbSource
  title        String
  url          String     @unique
  publisher    String     // "CFPB" | "IRS" | "NerdWallet" | ...
  fetchedAt    DateTime   @default(now())
  contentHash  String
  chunks       KbChunk[]
}

model KbChunk {
  id          String      @id @default(cuid())
  documentId  String
  document    KbDocument  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  order       Int
  heading     String?
  text        String
  tokenCount  Int
  embedding   Unsupported("vector(1536)")
  createdAt   DateTime    @default(now())

  @@index([documentId, order])
}
```

Hand-written SQL on top of the Prisma migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX kb_chunk_embedding_ivfflat_idx
  ON "KbChunk" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

Retrieval query (ai-service, `psycopg`):

```sql
SELECT id, "documentId", heading, text,
       1 - (embedding <=> $1::vector) AS score
FROM "KbChunk"
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

Top-k = 6, drop rows with score < 0.35. No reranker in MVP.

## Corpus ingestion

New package `ai-service/rag/` with CLI: `python -m rag.ingest`.

```
ai-service/rag/
├─ __init__.py
├─ ingest.py        # CLI entrypoint
├─ sources.py       # curated URL list
├─ fetch.py         # HTTP + PDF download, respects robots.txt, 1 req/2s
├─ extract.py       # PDF → text (pypdf); HTML → text (trafilatura)
├─ chunk.py         # heading-aware split, 500 tok target, 80 tok overlap
├─ embed.py         # OpenAI text-embedding-3-small, batch 100
└─ store.py         # upsert into KbDocument/KbChunk via psycopg
```

Starter corpus (~40 docs):

- **Gov (public domain)**: CFPB "Money Smart" chapters, IRS Pub 17 sections (income, deductions, retirement), Federal Reserve Consumer Compliance, SEC investor.gov basics, USA.gov consumer/finance.
- **Commercial (excerpt-only, always cite-and-link)**: 20-30 NerdWallet / Investopedia articles on budgeting frameworks, emergency fund sizing, credit utilization, subscription cancellation. Chunks capped at 300 words, every retrieval links back to source.

Ingest flow per URL:

1. GET; skip if `contentHash` matches existing `KbDocument`.
2. Extract text (pypdf for PDF, trafilatura for HTML).
3. Chunk by heading > paragraph, target 500 tokens with 80 overlap.
4. Embed all chunks in one OpenAI batch call.
5. UPSERT `KbDocument`, delete old `KbChunk`s, insert new.

Refresh: manual for MVP. Nightly cron in v2.

## Tool surface

Six tools registered with Anthropic tool-calling.

```python
TOOLS = [
    {
        "name": "searchDocs",
        "description": (
            "Search the WealthLens knowledge base of consumer-finance articles "
            "(CFPB, IRS, SEC, NerdWallet, Investopedia excerpts) for concepts, "
            "definitions, rules of thumb, or how-to guidance. Use whenever the "
            "user asks a general or educational question."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "k": {"type": "integer", "default": 6, "minimum": 1, "maximum": 12},
            },
            "required": ["query"],
        },
    },
    {
        "name": "getTransactions",
        "description": (
            "Fetch the signed-in user's recent transactions. Filter by category, "
            "merchant, date range, or amount. Use for questions about specific "
            "purchases or spend history."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "merchant": {"type": "string"},
                "startDate": {"type": "string", "format": "date"},
                "endDate": {"type": "string", "format": "date"},
                "minAmount": {"type": "number"},
                "maxAmount": {"type": "number"},
                "limit": {"type": "integer", "default": 50, "maximum": 200},
            },
        },
    },
    {
        "name": "getSubscriptions",
        "description": "List the user's detected recurring subscriptions with monthly cost, cadence, and last-charged date.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "getBalance",
        "description": "Return the user's current balance across accounts, or historical balance on a given date.",
        "input_schema": {
            "type": "object",
            "properties": {"asOfDate": {"type": "string", "format": "date"}},
        },
    },
    {
        "name": "getInsights",
        "description": "Fetch AI-generated insights already computed for this user (overdraft risk, category spikes, dormant subscriptions). Filter by severity.",
        "input_schema": {
            "type": "object",
            "properties": {"severity": {"type": "string", "enum": ["high", "medium", "low"]}},
        },
    },
    {
        "name": "getForecast",
        "description": "Return the user's cash-flow forecast (projected balance) for a given horizon (7d, 30d, 90d).",
        "input_schema": {
            "type": "object",
            "properties": {"horizonDays": {"type": "integer", "enum": [7, 30, 90], "default": 30}},
        },
    },
]
```

Backend callback endpoint (one URL, five personal-data tools):

```
POST /internal/advisor/tool
Authorization: Bearer <short-lived JWT signed by ai-service>
Body:    { tool: "getTransactions", args: {...}, userId: "..." }
Response: { data: <typed result> } | { error: "..." }
```

JWT signed with `ADVISOR_TOOL_SECRET` (shared env), 60-second TTL, `userId` claim. Backend verifies and calls existing Prisma queries. No new business logic — thin router over existing `getTransactions`, `getSubscriptions`, etc.

Guardrails:

- Max 8 tool iterations per turn.
- System prompt forbids citing personal-data tools with `[n]`; only `searchDocs` results get citations.
- If a personal tool returns empty, the model must say so plainly — never invent numbers.

## Request flow

Backend route (`backend/src/modules/chat/routes.ts`):

```ts
export async function answer(req, reply) {
  const { userId } = await req.clerkAuth();
  const { question, sessionId } = z.parse(BodySchema, req.body);

  const history = await prisma.chatHistory.findMany({
    where: { userId, sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const toolContext = {
    userId,
    plaidReady: (await prisma.plaidItem.count({ where: { userId } })) > 0,
    now: new Date().toISOString(),
  };

  await prisma.chatHistory.create({
    data: { userId, sessionId, role: "user", message: question },
  });

  const jwt = signAdvisorToolJwt({ userId, ttlSeconds: 120 });
  const resp = await fetch(`${AI_SERVICE_URL}/rag/answer`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tool-jwt": jwt },
    body: JSON.stringify({ question, toolContext, history }),
  });
  const payload = await resp.json();  // { answer, sources, toolTrace }

  await prisma.chatHistory.create({
    data: {
      userId, sessionId, role: "assistant",
      message: payload.answer,
      contextSnapshot: { sources: payload.sources, tools: payload.toolTrace },
    },
  });

  return reply.send(payload);
}
```

AI-service route (`ai-service/api/rag.py`):

```python
from anthropic import Anthropic
client = Anthropic()

async def answer(req: RagRequest) -> RagResponse:
    messages = to_anthropic_messages(req.history) + [{"role": "user", "content": req.question}]
    sources: list[Source] = []
    tool_trace: list[dict] = []
    tool_jwt = req.headers["x-tool-jwt"]

    for _ in range(MAX_TOOL_ITERS):  # 8
        resp = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            cache_control={"type": "ephemeral"},
        )
        if resp.stop_reason != "tool_use":
            break

        tool_results = []
        for block in resp.content:
            if block.type != "tool_use":
                continue
            tool_trace.append({"name": block.name, "input": block.input})
            if block.name == "searchDocs":
                hits = await pgvector_search(block.input["query"], k=block.input.get("k", 6))
                sources.extend(hits.to_sources(start_n=len(sources) + 1))
                tool_results.append(format_search_result(block.id, hits))
            else:
                data = await call_backend_tool(block.name, block.input, tool_jwt)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(data),
                })

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})

    answer_text = "".join(b.text for b in resp.content if b.type == "text")
    return RagResponse(answer=answer_text, sources=sources, tool_trace=tool_trace)
```

System prompt:

> You are WealthLens, a personal-finance advisor for the signed-in user. Use `searchDocs` for concepts, rules, and how-to. Use the personal-data tools for anything about the user's own money. Cite domain claims with `[1]`, `[2]` markers that match the retrieved documents in order. Never cite personal-data tools. If a personal tool returns no data, say so plainly and suggest connecting Plaid. Never invent numbers. Keep answers under 200 words unless the user asks for detail.

## Frontend

Response shape delivered to `AdvisorChat`:

```ts
type AdvisorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;              // may contain "…as CFPB notes [1], keep 3-6 months…"
  sources?: Array<{
    n: number;                  // 1-indexed, matches [n] marker
    title: string;
    publisher: string;
    url: string;
    snippet: string;            // ~140 chars, word-boundary trim
  }>;
  createdAt: string;
};
```

New component `frontend/components/advisor-message.tsx`:

- Split content on `/\[(\d+)\]/g`. For each numeric match, render a `[n]` superscript link styled with `bg-[var(--color-accent-soft)]` + `text-[var(--color-accent-text)]`.
- Below the bubble, if `sources?.length`, render a compact source list — number chip, publisher badge, title, external-link icon linking to `url`, snippet on second line in `text-slate-500 text-xs`.
- Clicking `[n]` scrolls to `#src-${n}` inside the same message and briefly highlights the row.
- No sources → no drawer.

Loading: existing spinner. Multi-hop sub-status ("Searching your transactions…") deferred to v2 with SSE.

`ChatHistory.contextSnapshot` (`Json`) stores `{sources, toolTrace}`. On history reload, sources render below the message exactly as they did the first time.

## Rollout

1. Prisma migration adds vector extension + KbDocument/KbChunk. Zero behavior change.
2. Corpus ingest MVP with 3 CFPB docs. Verify pgvector query returns something plausible.
3. `searchDocs` tool wired end-to-end. Backend advisor route + JWT plumbing. Curl-tested with `"what's an emergency fund?"`.
4. Frontend AdvisorMessage with citations. `/advisor` route shows cited replies.
5. Personal-data tools added one at a time: `getTransactions`, `getSubscriptions`, `getBalance`, `getInsights`, `getForecast`. Each ships with backend handler + tool schema + smoke test.
6. Full corpus seed (~40 docs). Reindex CLI runnable ad-hoc.
7. Deprecate legacy `refine_advisor_answer`; delete one release later.

## Testing

- **Backend** — Vitest: JWT sign/verify, tool-callback route, Prisma writes. New `backend/tests/advisor.test.ts`.
- **AI-service** — pytest: `tests/test_rag_chunk.py` (chunker), `tests/test_rag_search.py` (pgvector round-trip with tiny fixture corpus), `tests/test_rag_answer.py` (mocked Anthropic client, asserts tool loop terminates and sources shape).
- **Eval harness** — `python -m rag.eval` runs ~20 hand-written golden questions (10 domain, 10 personal), prints answer text + which sources hit. Manual grade. Run before + after any prompt/model change.

## Env

```
# ai-service/.env.example
ANTHROPIC_API_KEY=sk-ant-…
OPENAI_API_KEY=sk-…
DATABASE_URL=postgres://…          # reuses backend DB
ADVISOR_TOOL_SECRET=<shared 32-byte hex>
BACKEND_URL=http://localhost:8081

# backend/.env.example
AI_SERVICE_URL=http://localhost:8000
ADVISOR_TOOL_SECRET=<same secret>
```

## Cost guards

- OpenAI dashboard: hard spend cap $5/mo, soft alert $2.
- Anthropic workspace budget alert $10/mo.
- Rate-limit `/api/advisor/answer` to 30 req/min/user via existing `@fastify/rate-limit`.
- `MAX_TOOL_ITERS = 8` in ai-service; log and return 429 when the loop hits the ceiling.

## Fallback

If `ANTHROPIC_API_KEY` is missing, `/rag/answer` returns

```json
{"answer": "Advisor not configured. Ask an operator to set ANTHROPIC_API_KEY.", "sources": []}
```

preserving the existing fallback-friendly ethos in `CLAUDE.md`.
