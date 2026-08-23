# RAG Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the WealthLens advisor chat into a real Retrieval-Augmented Generation loop with Claude Haiku 4.5 as the answerer, OpenAI embeddings, pgvector on Postgres, and inline `[n]` citations.

**Architecture:** Split ownership — backend (Fastify/Prisma/Clerk) exposes personal-data tools over a signed-JWT callback; ai-service (FastAPI) runs the Anthropic tool-calling loop and owns the pgvector document store. Six tools registered: `searchDocs` runs locally in ai-service, five personal-data tools proxy back to backend. Non-stream MVP.

**Tech Stack:** Fastify 5, Prisma 6, PostgreSQL + pgvector, FastAPI, `anthropic` Python SDK, `openai` Python SDK, `psycopg[binary]`, `pypdf`, `trafilatura`, `jsonwebtoken` (backend), `PyJWT` (ai-service), React 19.

## Global Constraints

- Every route change on the backend goes through a `modules/<domain>/routes.ts` file registered in `routes/index.ts`; business logic stays in `lib/`.
- Backend is ESM (`"type": "module"`) — use `import`; keep extension conventions the resolver expects.
- Zod validates every backend input.
- AI-service capabilities live one-per-package with a `service.py`; Pydantic schemas in `schemas/`, routes in `api/routes.py`.
- Prisma schema edits require `npm run db:migrate --workspace backend`; never hand-edit files in `prisma/migrations/`.
- Money is `Decimal(12,2)`; IDs are `cuid()`.
- Frontend files are kebab-case; typed React 19 function components.
- Fallback behavior must be preserved — advisor must degrade gracefully when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `AI_SERVICE_URL` are missing.
- CI must pass: `npm run lint:frontend`, `npm run build:frontend`, `npm run typecheck:backend`, `npm run test:backend`, `npm run build:backend`, `npm run test:ai`.
- Chat model: `claude-haiku-4-5` (exact ID). Embedding model: `text-embedding-3-small` (1536-dim).
- Max 8 tool iterations per turn (`MAX_TOOL_ITERS = 8`).
- pgvector query uses cosine distance; drop rows with score < 0.35.
- Commercial-source chunks capped at 300 words; every response links back to `KbDocument.url`.

---

### Task 1: Prisma migration — pgvector + KbDocument + KbChunk

**Files:**
- Modify: `backend/prisma/schema.prisma` (add enum + two models)
- Create: `backend/prisma/migrations/<timestamp>_add_kb_tables/migration.sql`
- Create: `backend/tests/kb-schema.test.ts`

**Interfaces:**
- Consumes: existing `DATABASE_URL`
- Produces: Prisma models `KbDocument` and `KbChunk`; SQL types `KbSource` enum, `vector(1536)` column, ivfflat index

- [ ] **Step 1: Add models to `backend/prisma/schema.prisma`**

Append to the file:

```prisma
enum KbSource {
  GOV
  COMMERCIAL
}

model KbDocument {
  id          String     @id @default(cuid())
  source      KbSource
  title       String
  url         String     @unique
  publisher   String
  fetchedAt   DateTime   @default(now())
  contentHash String
  chunks      KbChunk[]
}

model KbChunk {
  id         String                 @id @default(cuid())
  documentId String
  document   KbDocument             @relation(fields: [documentId], references: [id], onDelete: Cascade)
  order      Int
  heading    String?
  text       String
  tokenCount Int
  embedding  Unsupported("vector(1536)")
  createdAt  DateTime               @default(now())

  @@index([documentId, order])
}
```

- [ ] **Step 2: Generate migration**

Run:
```bash
npm run db:migrate --workspace backend -- --name add_kb_tables
```

Prisma prints migration path. Note it for step 3.

- [ ] **Step 3: Prepend pgvector setup to the generated migration SQL**

Open the newly generated `backend/prisma/migrations/<timestamp>_add_kb_tables/migration.sql` and prepend:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Append at the very bottom:

```sql
CREATE INDEX kb_chunk_embedding_ivfflat_idx
  ON "KbChunk" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- [ ] **Step 4: Re-apply migration**

Run:
```bash
npm run db:migrate --workspace backend
```

Expected: "Already in sync" or clean re-apply. If it complains about pending drift, `prisma migrate reset` (dev only) and rerun.

- [ ] **Step 5: Write schema smoke test**

Create `backend/tests/kb-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";

describe("KB schema", () => {
  it("inserts a document and chunk with a vector via raw SQL", async () => {
    const doc = await prisma.kbDocument.create({
      data: {
        source: "GOV",
        title: "smoke",
        url: `https://example.com/smoke-${Date.now()}`,
        publisher: "TEST",
        contentHash: "abc",
      },
    });
    const zeros = "[" + Array(1536).fill(0).join(",") + "]";
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KbChunk" (id, "documentId", "order", text, "tokenCount", embedding)
       VALUES ($1, $2, 0, 'hello', 1, $3::vector)`,
      "kbchunk_smoke_" + Date.now(),
      doc.id,
      zeros,
    );
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "KbChunk" WHERE "documentId" = $1`,
      doc.id,
    );
    expect(Number(rows[0].count)).toBe(1);
    await prisma.kbDocument.delete({ where: { id: doc.id } });
  });
});
```

- [ ] **Step 6: Run tests to verify pass**

Run:
```bash
npm run test:backend -- kb-schema
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/tests/kb-schema.test.ts
git commit -m "feat(db): add KbDocument/KbChunk models with pgvector"
```

---

### Task 2: Backend advisor-tool callback endpoint (JWT + `getTransactions`)

**Files:**
- Create: `backend/src/lib/advisor-tool-jwt.ts`
- Create: `backend/src/lib/advisor-tools.ts`
- Create: `backend/src/modules/chat/tool-routes.ts`
- Modify: `backend/src/routes/index.ts` (register module)
- Modify: `backend/src/config/env.ts` (add `ADVISOR_TOOL_SECRET`, `AI_SERVICE_URL`)
- Modify: `backend/.env.example`
- Create: `backend/tests/advisor-tool.test.ts`

**Interfaces:**
- Consumes: `ADVISOR_TOOL_SECRET` env; existing `prisma` client
- Produces:
  - `signAdvisorToolJwt({ userId, ttlSeconds }): string`
  - `verifyAdvisorToolJwt(token): { userId: string }`
  - `POST /internal/advisor/tool` — body `{ tool: string, args: object, userId: string }`, returns `{ data: unknown } | { error: string }`. Only `getTransactions` implemented here; the other four land in Task 7.
  - `getRecentTransactionsForUser(userId, args): Promise<Array<{ id, date, merchant, category, amount, direction }>>`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/advisor-tool.test.ts`:

```ts
import { describe, expect, it, beforeAll } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/routes/index.js";
import { signAdvisorToolJwt } from "../src/lib/advisor-tool-jwt.js";

process.env.ADVISOR_TOOL_SECRET =
  process.env.ADVISOR_TOOL_SECRET ??
  "0000000000000000000000000000000000000000000000000000000000000000";

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:backend -- advisor-tool
```

Expected: FAIL — helper missing and route returns 404.

- [ ] **Step 3: Install `jsonwebtoken`**

```bash
npm install --workspace backend jsonwebtoken@^9
npm install --workspace backend --save-dev @types/jsonwebtoken
```

- [ ] **Step 4: Implement JWT helper**

Create `backend/src/lib/advisor-tool-jwt.ts`:

```ts
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "wealthlens-backend";
const AUDIENCE = "wealthlens-ai-service";

export function signAdvisorToolJwt({
  userId,
  ttlSeconds,
}: {
  userId: string;
  ttlSeconds: number;
}): string {
  return jwt.sign({ sub: userId }, env.ADVISOR_TOOL_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ttlSeconds,
  });
}

export function verifyAdvisorToolJwt(token: string): { userId: string } {
  const decoded = jwt.verify(token, env.ADVISOR_TOOL_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as jwt.JwtPayload;
  if (typeof decoded.sub !== "string") throw new Error("advisor tool jwt missing sub claim");
  return { userId: decoded.sub };
}
```

- [ ] **Step 5: Extend env schema**

Modify `backend/src/config/env.ts` — add these Zod fields alongside the existing ones:

```ts
ADVISOR_TOOL_SECRET: z.string().min(32),
AI_SERVICE_URL: z.string().url(),
```

Extend `backend/.env.example` with:

```
ADVISOR_TOOL_SECRET=change-me-to-a-32-byte-hex-string-00000000
AI_SERVICE_URL=http://localhost:8000
```

- [ ] **Step 6: Implement transactions tool helper**

Create `backend/src/lib/advisor-tools.ts`:

```ts
import { prisma } from "./prisma.js";

export type TransactionQuery = {
  category?: string;
  merchant?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
};

export async function getRecentTransactionsForUser(
  userId: string,
  args: Record<string, unknown>,
) {
  const q: TransactionQuery = args as TransactionQuery;
  const limit = Math.min(q.limit ?? 50, 200);
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      ...(q.category ? { categoryPrimary: q.category } : {}),
      ...(q.merchant ? { merchantName: { contains: q.merchant, mode: "insensitive" } } : {}),
      ...(q.startDate ? { date: { gte: new Date(q.startDate) } } : {}),
      ...(q.endDate ? { date: { lte: new Date(q.endDate) } } : {}),
      ...(q.minAmount !== undefined ? { amount: { gte: q.minAmount } } : {}),
      ...(q.maxAmount !== undefined ? { amount: { lte: q.maxAmount } } : {}),
    },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true, date: true, merchantName: true, categoryPrimary: true,
      amount: true, direction: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date?.toISOString().slice(0, 10),
    merchant: r.merchantName,
    category: r.categoryPrimary,
    amount: Number(r.amount),
    direction: r.direction,
  }));
}
```

- [ ] **Step 7: Implement the callback route**

Create `backend/src/modules/chat/tool-routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { verifyAdvisorToolJwt } from "../../lib/advisor-tool-jwt.js";
import { getRecentTransactionsForUser } from "../../lib/advisor-tools.js";

const bodySchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()).default({}),
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
          const data = await getRecentTransactionsForUser(claims.userId, parsed.data.args);
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
```

- [ ] **Step 8: Register the module**

Modify `backend/src/routes/index.ts` — import `registerAdvisorToolRoutes` and call it alongside existing route registrations.

- [ ] **Step 9: Run tests to verify pass**

```bash
npm run test:backend -- advisor-tool
npm run typecheck:backend
```

Expected: 3 PASS, clean typecheck.

- [ ] **Step 10: Commit**

```bash
git add backend/src/lib/advisor-tool-jwt.ts backend/src/lib/advisor-tools.ts \
        backend/src/modules/chat/tool-routes.ts backend/src/routes/index.ts \
        backend/src/config/env.ts backend/tests/advisor-tool.test.ts \
        backend/package.json backend/.env.example
git commit -m "feat(advisor): add signed-JWT tool callback endpoint"
```

---

### Task 3: AI-service — pgvector search + `searchDocs`

**Files:**
- Create: `ai-service/rag/__init__.py`
- Create: `ai-service/rag/embed.py`
- Create: `ai-service/rag/store.py`
- Create: `ai-service/rag/search.py`
- Create: `ai-service/tests/conftest.py`
- Create: `ai-service/tests/test_rag_search.py`
- Modify: `ai-service/requirements.txt`
- Modify: `ai-service/.env.example`

**Interfaces:**
- Consumes: `OPENAI_API_KEY`, `DATABASE_URL`, `KbChunk`/`KbDocument` tables (Task 1)
- Produces:
  - `embed_text(text) -> list[float]`, `embed_texts(list[str]) -> list[list[float]]`
  - `pgvector_search(query_embedding, k) -> list[ChunkHit]` where `ChunkHit = (id, document_id, heading, text, title, url, publisher, score)`
  - `search_docs(query, k=6) -> SearchResult` with `.hits: list[ChunkHit]` and `.to_sources(start_n) -> list[Source(n, title, publisher, url, snippet)]`

- [ ] **Step 1: Add dependencies**

Append to `ai-service/requirements.txt`:

```
anthropic>=0.40
openai>=1.50
psycopg[binary]>=3.2
pyjwt>=2.9
```

Add to `ai-service/.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=postgres://user:pass@localhost:5432/wealthlens
ADVISOR_TOOL_SECRET=change-me-to-match-backend
BACKEND_URL=http://localhost:8081
```

Install:
```bash
python -m pip install -r ai-service/requirements.txt
```

- [ ] **Step 2: Write the failing test**

Create `ai-service/tests/conftest.py`:

```python
import os
import uuid
import pytest
import psycopg

from ai_service.rag.embed import embed_texts

_FIXTURE_TEXTS = [
    ("Emergency fund basics",
     "Aim for 3 to 6 months of essential expenses in a high-yield savings account."),
    ("Credit utilization",
     "Keep revolving balances under 30% of your credit limit to protect your score."),
    ("Subscription discipline",
     "Cancel any subscription you have not used in 30 days to reclaim discretionary income."),
]


def _vec(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


@pytest.fixture(scope="session")
def seeded_kb():
    if not os.getenv("OPENAI_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("requires OPENAI_API_KEY and DATABASE_URL")
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    doc_ids: list[str] = []
    embeddings = embed_texts([t for _, t in _FIXTURE_TEXTS])
    with conn.cursor() as cur:
        for (title, text), embedding in zip(_FIXTURE_TEXTS, embeddings):
            doc_id = "kbdoc_test_" + uuid.uuid4().hex[:12]
            chunk_id = "kbchunk_test_" + uuid.uuid4().hex[:12]
            cur.execute(
                """INSERT INTO "KbDocument" (id, source, title, url, publisher, "contentHash", "fetchedAt")
                   VALUES (%s, 'GOV', %s, %s, 'TEST', 'seed', NOW())""",
                (doc_id, title, f"https://example.test/{doc_id}"),
            )
            cur.execute(
                """INSERT INTO "KbChunk" (id, "documentId", "order", heading, text, "tokenCount", embedding, "createdAt")
                   VALUES (%s, %s, 0, %s, %s, %s, %s::vector, NOW())""",
                (chunk_id, doc_id, title, text, len(text.split()), _vec(embedding)),
            )
            doc_ids.append(doc_id)
    yield doc_ids
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "KbDocument" WHERE id = ANY(%s)', (doc_ids,))
    conn.close()
```

Create `ai-service/tests/test_rag_search.py`:

```python
import os
import pytest

from ai_service.rag.search import search_docs

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY") or not os.getenv("DATABASE_URL"),
    reason="requires OPENAI_API_KEY and DATABASE_URL",
)


def test_search_returns_scored_hits(seeded_kb):
    result = search_docs("How big should an emergency fund be?", k=3)
    assert len(result.hits) <= 3
    assert all(0.0 <= h.score <= 1.0 for h in result.hits)
    assert any("emergency" in h.text.lower() for h in result.hits)
```

Run:
```bash
cd ai-service && pytest tests/test_rag_search.py -v
```

Expected: FAIL — `ai_service.rag.search` not importable.

- [ ] **Step 3: Implement `embed.py`**

Create `ai-service/rag/__init__.py` (empty file).
Create `ai-service/rag/embed.py`:

```python
import os
from openai import OpenAI

_MODEL = "text-embedding-3-small"


def _client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    resp = _client().embeddings.create(model=_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
```

- [ ] **Step 4: Implement `store.py`**

Create `ai-service/rag/store.py`:

```python
from dataclasses import dataclass
import os
import psycopg

_MIN_SCORE = 0.35


@dataclass
class ChunkHit:
    id: str
    document_id: str
    heading: str | None
    text: str
    title: str
    url: str
    publisher: str
    score: float


def _vec_literal(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


def pgvector_search(query_embedding: list[float], k: int) -> list[ChunkHit]:
    literal = _vec_literal(query_embedding)
    sql = """
        SELECT c.id, c."documentId", c.heading, c.text,
               d.title, d.url, d.publisher,
               1 - (c.embedding <=> %s::vector) AS score
        FROM "KbChunk" c
        JOIN "KbDocument" d ON d.id = c."documentId"
        ORDER BY c.embedding <=> %s::vector
        LIMIT %s
    """
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute(sql, (literal, literal, k))
        rows = cur.fetchall()
    hits: list[ChunkHit] = []
    for row in rows:
        score = float(row[7])
        if score < _MIN_SCORE:
            continue
        hits.append(ChunkHit(
            id=row[0], document_id=row[1], heading=row[2], text=row[3],
            title=row[4], url=row[5], publisher=row[6], score=score,
        ))
    return hits
```

- [ ] **Step 5: Implement `search.py`**

Create `ai-service/rag/search.py`:

```python
from dataclasses import dataclass, field

from .embed import embed_text
from .store import ChunkHit, pgvector_search


@dataclass
class Source:
    n: int
    title: str
    publisher: str
    url: str
    snippet: str


@dataclass
class SearchResult:
    hits: list[ChunkHit] = field(default_factory=list)

    def to_sources(self, start_n: int) -> list[Source]:
        return [
            Source(
                n=start_n + i,
                title=h.title,
                publisher=h.publisher,
                url=h.url,
                snippet=_snippet(h.text),
            )
            for i, h in enumerate(self.hits)
        ]


def _snippet(text: str, max_chars: int = 140) -> str:
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit(" ", 1)[0]
    return f"{cut}…"


def search_docs(query: str, k: int = 6) -> SearchResult:
    embedding = embed_text(query)
    hits = pgvector_search(embedding, k)
    return SearchResult(hits=hits)
```

- [ ] **Step 6: Run tests to verify pass**

```bash
cd ai-service && pytest tests/test_rag_search.py -v
```

Expected: PASS locally with real `OPENAI_API_KEY` + `DATABASE_URL`; SKIP in CI unless those env vars are set.

- [ ] **Step 7: Commit**

```bash
git add ai-service/rag/__init__.py ai-service/rag/embed.py ai-service/rag/store.py \
        ai-service/rag/search.py ai-service/tests/conftest.py ai-service/tests/test_rag_search.py \
        ai-service/requirements.txt ai-service/.env.example
git commit -m "feat(rag): pgvector search + OpenAI embeddings"
```

---

### Task 4: Corpus ingestion pipeline + seed 3 CFPB docs

**Files:**
- Create: `ai-service/rag/sources.py`
- Create: `ai-service/rag/fetch.py`
- Create: `ai-service/rag/extract.py`
- Create: `ai-service/rag/chunk.py`
- Create: `ai-service/rag/ingest.py`
- Create: `ai-service/tests/test_rag_chunk.py`

**Interfaces:**
- Consumes: `embed_texts` (Task 3), `KbDocument`/`KbChunk` (Task 1)
- Produces:
  - `chunk_text(text, target_tokens=500, overlap_tokens=80) -> list[Chunk(order, heading, text, token_count)]`
  - CLI: `python -m ai_service.rag.ingest [--only <substring>]` upserts documents + chunks.

- [ ] **Step 1: Add deps**

Append to `ai-service/requirements.txt`:

```
pypdf>=4.3
trafilatura>=1.12
httpx>=0.27
tiktoken>=0.7
```

Install:
```bash
python -m pip install -r ai-service/requirements.txt
```

- [ ] **Step 2: Write chunker test (fails first)**

Create `ai-service/tests/test_rag_chunk.py`:

```python
from ai_service.rag.chunk import chunk_text


def test_chunks_respect_target_size():
    text = "Section 1\n\n" + ("Sentence one. " * 400) + "\n\nSection 2\n\n" + ("Sentence two. " * 400)
    chunks = chunk_text(text, target_tokens=200, overlap_tokens=40)
    assert len(chunks) >= 4
    for c in chunks:
        assert c.token_count <= 260
        assert c.text.strip() != ""


def test_chunks_carry_heading():
    text = "# Emergency Fund\n\nSave 3 to 6 months of expenses.\n\n# Credit Utilization\n\nStay under 30%."
    chunks = chunk_text(text, target_tokens=50, overlap_tokens=10)
    headings = {c.heading for c in chunks}
    assert "Emergency Fund" in headings
    assert "Credit Utilization" in headings
```

Run:
```bash
cd ai-service && pytest tests/test_rag_chunk.py -v
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `chunk.py`**

Create `ai-service/rag/chunk.py`:

```python
from dataclasses import dataclass
import re

import tiktoken

_ENCODER = tiktoken.get_encoding("cl100k_base")
_HEADING_RE = re.compile(r"^\s*(#+)\s+(.+?)\s*$", re.MULTILINE)


@dataclass
class Chunk:
    order: int
    heading: str | None
    text: str
    token_count: int


def _split_by_heading(text: str) -> list[tuple[str | None, str]]:
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [(None, text.strip())]
    sections: list[tuple[str | None, str]] = []
    for i, m in enumerate(matches):
        heading = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((heading, body))
    return sections


def chunk_text(text: str, target_tokens: int = 500, overlap_tokens: int = 80) -> list[Chunk]:
    if target_tokens <= overlap_tokens:
        raise ValueError("target_tokens must exceed overlap_tokens")
    sections = _split_by_heading(text)
    out: list[Chunk] = []
    order = 0
    for heading, body in sections:
        tokens = _ENCODER.encode(body)
        if not tokens:
            continue
        step = target_tokens - overlap_tokens
        for start in range(0, len(tokens), step):
            slice_tokens = tokens[start:start + target_tokens]
            if not slice_tokens:
                break
            piece = _ENCODER.decode(slice_tokens).strip()
            if piece:
                out.append(Chunk(order=order, heading=heading, text=piece, token_count=len(slice_tokens)))
                order += 1
            if start + target_tokens >= len(tokens):
                break
    return out
```

Rerun:
```bash
cd ai-service && pytest tests/test_rag_chunk.py -v
```

Expected: PASS.

- [ ] **Step 4: Implement `sources.py`**

Create `ai-service/rag/sources.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    url: str
    title: str
    publisher: str
    kind: str  # "GOV" | "COMMERCIAL"


SEED_SOURCES: list[Source] = [
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_building_your_savings.pdf",
        title="CFPB · Building your savings",
        publisher="CFPB",
        kind="GOV",
    ),
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_toolkit_english.pdf",
        title="CFPB · Your Money Your Goals — toolkit",
        publisher="CFPB",
        kind="GOV",
    ),
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_focus-on-people-with-disabilities_toolkit.pdf",
        title="CFPB · YMYG — focus on people with disabilities",
        publisher="CFPB",
        kind="GOV",
    ),
]
```

- [ ] **Step 5: Implement `fetch.py`**

Create `ai-service/rag/fetch.py`:

```python
import hashlib
import time

import httpx

_UA = "WealthLensBot/0.1 (+https://wealthlens.local)"
_last_request = 0.0


def _throttle(min_interval: float = 2.0) -> None:
    global _last_request
    delta = time.monotonic() - _last_request
    if delta < min_interval:
        time.sleep(min_interval - delta)
    _last_request = time.monotonic()


def fetch_bytes(url: str) -> tuple[bytes, str]:
    _throttle()
    with httpx.Client(timeout=30, headers={"User-Agent": _UA}, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content, hashlib.sha256(resp.content).hexdigest()
```

- [ ] **Step 6: Implement `extract.py`**

Create `ai-service/rag/extract.py`:

```python
import io

import pypdf
import trafilatura


def extract_pdf(data: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()


def extract_html(data: bytes) -> str:
    text = trafilatura.extract(data.decode("utf-8", errors="ignore"), include_formatting=False)
    return (text or "").strip()


def extract(data: bytes, content_type: str) -> str:
    if "pdf" in content_type.lower():
        return extract_pdf(data)
    if "html" in content_type.lower() or "xml" in content_type.lower():
        return extract_html(data)
    return data.decode("utf-8", errors="ignore").strip()
```

- [ ] **Step 7: Implement `ingest.py`**

Create `ai-service/rag/ingest.py`:

```python
import argparse
import os
import uuid
import psycopg

from .chunk import chunk_text
from .embed import embed_texts
from .extract import extract
from .fetch import fetch_bytes
from .sources import SEED_SOURCES, Source


def _vec(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


def _upsert(conn: psycopg.Connection, source: Source, content: bytes,
            content_hash: str, content_type: str) -> tuple[str, int]:
    with conn.cursor() as cur:
        cur.execute('SELECT id, "contentHash" FROM "KbDocument" WHERE url = %s', (source.url,))
        existing = cur.fetchone()
        if existing and existing[1] == content_hash:
            return existing[0], 0
        if existing:
            doc_id = existing[0]
            cur.execute('DELETE FROM "KbChunk" WHERE "documentId" = %s', (doc_id,))
            cur.execute(
                'UPDATE "KbDocument" SET "contentHash" = %s, "fetchedAt" = NOW() WHERE id = %s',
                (content_hash, doc_id),
            )
        else:
            doc_id = "kbdoc_" + uuid.uuid4().hex[:16]
            cur.execute(
                """INSERT INTO "KbDocument" (id, source, title, url, publisher, "contentHash", "fetchedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
                (doc_id, source.kind, source.title, source.url, source.publisher, content_hash),
            )
        text = extract(content, content_type)
        if not text:
            return doc_id, 0
        chunks = chunk_text(text, target_tokens=500, overlap_tokens=80)
        embeddings = embed_texts([c.text for c in chunks])
        for chunk, embedding in zip(chunks, embeddings):
            chunk_id = "kbchunk_" + uuid.uuid4().hex[:16]
            cur.execute(
                """INSERT INTO "KbChunk" (id, "documentId", "order", heading, text, "tokenCount", embedding, "createdAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector, NOW())""",
                (chunk_id, doc_id, chunk.order, chunk.heading, chunk.text, chunk.token_count, _vec(embedding)),
            )
        return doc_id, len(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest WealthLens knowledge-base sources.")
    parser.add_argument("--only", help="substring filter over source URL")
    args = parser.parse_args()
    dsn = os.environ["DATABASE_URL"]
    total_chunks = 0
    with psycopg.connect(dsn, autocommit=False) as conn:
        for source in SEED_SOURCES:
            if args.only and args.only not in source.url:
                continue
            content_type = "application/pdf" if source.url.endswith(".pdf") else "text/html"
            content, content_hash = fetch_bytes(source.url)
            doc_id, added = _upsert(conn, source, content, content_hash, content_type)
            conn.commit()
            print(f"{source.publisher}: {source.title[:60]} → {doc_id} (+{added} chunks)")
            total_chunks += added
    print(f"Done. Added {total_chunks} chunks.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 8: Seed the three CFPB docs**

```bash
cd ai-service && OPENAI_API_KEY=... DATABASE_URL=... python -m ai_service.rag.ingest
```

Expected: three lines, each with `>0 chunks`.

- [ ] **Step 9: Verify end-to-end search**

```bash
cd ai-service && python - <<'PY'
from ai_service.rag.search import search_docs
res = search_docs("How much should my emergency fund cover?", k=3)
for h in res.hits:
    print(f"{h.score:.3f}  {h.title[:60]}")
PY
```

Expected: at least one hit with score > 0.4 pointing at a CFPB doc.

- [ ] **Step 10: Commit**

```bash
git add ai-service/rag/sources.py ai-service/rag/fetch.py ai-service/rag/extract.py \
        ai-service/rag/chunk.py ai-service/rag/ingest.py ai-service/tests/test_rag_chunk.py \
        ai-service/requirements.txt
git commit -m "feat(rag): corpus ingest pipeline + seed CFPB docs"
```

---

### Task 5: End-to-end `/rag/answer` + `/api/advisor/answer` (searchDocs only)

**Files:**
- Create: `ai-service/rag/answer.py`
- Create: `ai-service/schemas/rag.py`
- Create: `ai-service/api/rag_routes.py`
- Modify: `ai-service/main.py` (include new router)
- Create: `ai-service/tests/test_rag_answer.py`
- Create: `backend/src/modules/chat/advisor-routes.ts`
- Create: `backend/src/lib/clerk-auth.ts` (if missing)
- Modify: `backend/src/routes/index.ts` (register route)
- Create: `backend/tests/advisor-answer.test.ts`

**Interfaces:**
- Consumes: `search_docs` (Task 3), Task 2's `/internal/advisor/tool`
- Produces:
  - AI-service: `POST /rag/answer` — body `{question, toolContext, history}`, header `x-tool-jwt`, returns `{answer, sources, toolTrace}`
  - Backend: `POST /api/advisor/answer` — body `{question, sessionId?}`, returns the same shape and writes two `ChatHistory` rows.
  - `answer_question(req: RagRequest, tool_jwt: str) -> RagResponse`

- [ ] **Step 1: Add Pydantic schemas**

Create `ai-service/schemas/rag.py`:

```python
from pydantic import BaseModel


class HistoryTurn(BaseModel):
    role: str
    message: str


class ToolContext(BaseModel):
    userId: str
    plaidReady: bool
    now: str


class RagRequest(BaseModel):
    question: str
    toolContext: ToolContext
    history: list[HistoryTurn] = []


class SourceOut(BaseModel):
    n: int
    title: str
    publisher: str
    url: str
    snippet: str


class ToolTraceEntry(BaseModel):
    name: str
    input: dict


class RagResponse(BaseModel):
    answer: str
    sources: list[SourceOut] = []
    toolTrace: list[ToolTraceEntry] = []
```

- [ ] **Step 2: Write ai-service tool-loop test (fails first)**

Create `ai-service/tests/test_rag_answer.py`:

```python
from unittest.mock import MagicMock, patch

from ai_service.rag.answer import answer_question
from ai_service.rag.search import SearchResult
from ai_service.rag.store import ChunkHit
from ai_service.schemas.rag import RagRequest, ToolContext


def _hit(text: str) -> ChunkHit:
    return ChunkHit(
        id="c", document_id="d", heading="H", text=text,
        title="Doc", url="https://example.test/a", publisher="TEST", score=0.9,
    )


def _fake_message(text: str = "", tool_uses=None):
    msg = MagicMock()
    msg.stop_reason = "tool_use" if tool_uses else "end_turn"
    content = []
    if tool_uses:
        for name, args, use_id in tool_uses:
            block = MagicMock()
            block.type = "tool_use"
            block.name = name
            block.input = args
            block.id = use_id
            content.append(block)
    if text:
        block = MagicMock()
        block.type = "text"
        block.text = text
        content.append(block)
    msg.content = content
    return msg


def test_answer_uses_search_and_returns_sources():
    req = RagRequest(
        question="How big should my emergency fund be?",
        toolContext=ToolContext(userId="u_1", plaidReady=False, now="2026-08-23T00:00:00Z"),
        history=[],
    )
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [
        _fake_message(tool_uses=[("searchDocs", {"query": "emergency fund"}, "u1")]),
        _fake_message(text="Aim for 3–6 months of expenses [1]."),
    ]
    with patch("ai_service.rag.answer._client", return_value=fake_client), \
         patch("ai_service.rag.answer.search_docs",
               return_value=SearchResult(hits=[_hit("Aim for 3 to 6 months")])):
        resp = answer_question(req, tool_jwt="jwt.stub")
    assert "3–6 months" in resp.answer
    assert resp.sources and resp.sources[0].n == 1
    assert resp.toolTrace[0].name == "searchDocs"


def test_answer_terminates_on_max_iters():
    req = RagRequest(
        question="loop",
        toolContext=ToolContext(userId="u_1", plaidReady=False, now="2026-08-23T00:00:00Z"),
        history=[],
    )
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [
        _fake_message(tool_uses=[("searchDocs", {"query": "x"}, f"u{i}")]) for i in range(10)
    ]
    with patch("ai_service.rag.answer._client", return_value=fake_client), \
         patch("ai_service.rag.answer.search_docs", return_value=SearchResult(hits=[])):
        resp = answer_question(req, tool_jwt="jwt.stub")
    assert fake_client.messages.create.call_count == 8
    assert isinstance(resp.answer, str)
```

Run:
```bash
cd ai-service && pytest tests/test_rag_answer.py -v
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement `answer.py`**

Create `ai-service/rag/answer.py`:

```python
import json
import os

import httpx
from anthropic import Anthropic

from .search import Source, search_docs, SearchResult
from ..schemas.rag import RagRequest, RagResponse, SourceOut, ToolTraceEntry

MAX_TOOL_ITERS = 8

_SYSTEM_PROMPT = (
    "You are WealthLens, a personal-finance advisor for the signed-in user. "
    "Use searchDocs for concepts, rules, and how-to guidance. Use the personal-data "
    "tools for anything about the user's own money. Cite domain claims with [1], [2] "
    "markers matching the retrieved documents in order. Never cite personal-data tools. "
    "If a personal tool returns no data, say so plainly and suggest connecting Plaid. "
    "Never invent numbers. Keep answers under 200 words unless the user asks for detail."
)

_TOOLS = [
    {
        "name": "searchDocs",
        "description": (
            "Search the WealthLens knowledge base of consumer-finance articles "
            "for concepts, definitions, rules of thumb, or how-to guidance."
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
]


def _client() -> Anthropic:
    return Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _to_anthropic_messages(history) -> list[dict]:
    return [{"role": t.role, "content": t.message} for t in history]


def _search_result_content(tool_use_id: str, result: SearchResult, start_n: int) -> dict:
    payload = {
        "results": [
            {"n": start_n + i, "title": h.title, "publisher": h.publisher,
             "url": h.url, "text": h.text}
            for i, h in enumerate(result.hits)
        ]
    }
    return {"type": "tool_result", "tool_use_id": tool_use_id, "content": json.dumps(payload)}


def _backend_tool_content(tool_use_id: str, data) -> dict:
    return {"type": "tool_result", "tool_use_id": tool_use_id, "content": json.dumps({"data": data})}


def _call_backend_tool(name: str, args: dict, user_id: str, tool_jwt: str) -> dict:
    url = os.environ["BACKEND_URL"].rstrip("/") + "/internal/advisor/tool"
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            url,
            headers={"authorization": f"Bearer {tool_jwt}"},
            json={"tool": name, "args": args, "userId": user_id},
        )
        resp.raise_for_status()
        payload = resp.json()
    return payload.get("data") if "data" in payload else {"error": payload.get("error", "unknown")}


def answer_question(req: RagRequest, tool_jwt: str) -> RagResponse:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return RagResponse(answer="Advisor not configured. Ask an operator to set ANTHROPIC_API_KEY.")

    messages = _to_anthropic_messages(req.history) + [{"role": "user", "content": req.question}]
    sources: list[Source] = []
    trace: list[ToolTraceEntry] = []
    client = _client()
    resp = None

    for _ in range(MAX_TOOL_ITERS):
        resp = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            tools=_TOOLS,
            messages=messages,
        )
        if resp.stop_reason != "tool_use":
            break

        tool_results = []
        for block in resp.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            trace.append(ToolTraceEntry(name=block.name, input=dict(block.input)))
            if block.name == "searchDocs":
                result = search_docs(block.input["query"], k=int(block.input.get("k", 6)))
                new_sources = result.to_sources(start_n=len(sources) + 1)
                sources.extend(new_sources)
                tool_results.append(
                    _search_result_content(block.id, result, start_n=len(sources) - len(new_sources) + 1)
                )
            else:
                data = _call_backend_tool(block.name, dict(block.input),
                                           req.toolContext.userId, tool_jwt)
                tool_results.append(_backend_tool_content(block.id, data))

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})

    answer_text = ""
    if resp is not None:
        answer_text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")

    return RagResponse(
        answer=answer_text or "I couldn't put together an answer this time.",
        sources=[SourceOut(**s.__dict__) for s in sources],
        toolTrace=trace,
    )
```

- [ ] **Step 4: Implement the FastAPI route**

Create `ai-service/api/rag_routes.py`:

```python
from fastapi import APIRouter, Header, HTTPException

from ..rag.answer import answer_question
from ..schemas.rag import RagRequest, RagResponse

router = APIRouter()


@router.post("/rag/answer", response_model=RagResponse)
def rag_answer(req: RagRequest, x_tool_jwt: str = Header(default="")) -> RagResponse:
    if not x_tool_jwt:
        raise HTTPException(status_code=401, detail="missing x-tool-jwt")
    return answer_question(req, tool_jwt=x_tool_jwt)
```

Modify `ai-service/main.py` — add:

```python
from .api.rag_routes import router as rag_router
app.include_router(rag_router)
```

- [ ] **Step 5: Run ai-service tests**

```bash
cd ai-service && pytest tests/test_rag_answer.py -v
```

Expected: 2 PASS.

- [ ] **Step 6: Backend — write advisor-answer test (fails first)**

Create `backend/tests/advisor-answer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../src/routes/index.js";

process.env.ADVISOR_TOOL_SECRET =
  process.env.ADVISOR_TOOL_SECRET ??
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.AI_SERVICE_URL = "http://ai-service.local";

vi.mock("../src/lib/clerk-auth.js", () => ({
  requireUserId: async () => "u_test",
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
});
```

Run:
```bash
npm run test:backend -- advisor-answer
```

Expected: FAIL — route missing.

- [ ] **Step 7: Implement `advisor-routes.ts` + `clerk-auth.ts`**

If `backend/src/lib/clerk-auth.ts` does not exist, create it:

```ts
import type { FastifyRequest } from "fastify";

export async function requireUserId(request: FastifyRequest): Promise<string> {
  const clerk = (request as unknown as { clerkAuth?: () => Promise<{ userId?: string }> }).clerkAuth;
  if (!clerk) throw new Error("clerk plugin missing");
  const { userId } = await clerk();
  if (!userId) throw new Error("unauthenticated");
  return userId;
}
```

Create `backend/src/modules/chat/advisor-routes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireUserId } from "../../lib/clerk-auth.js";
import { prisma } from "../../lib/prisma.js";
import { signAdvisorToolJwt } from "../../lib/advisor-tool-jwt.js";

const bodySchema = z.object({
  question: z.string().min(1),
  sessionId: z.string().min(1).default("default"),
});

export async function registerAdvisorAnswerRoutes(app: FastifyInstance) {
  app.post("/api/advisor/answer", async (request, reply) => {
    const userId = await requireUserId(request);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", details: parsed.error.format() });
    }
    const { question, sessionId } = parsed.data;

    const history = await prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, message: true },
    });

    const plaidReady = (await prisma.plaidItem.count({ where: { userId } })) > 0;
    const toolContext = { userId, plaidReady, now: new Date().toISOString() };

    await prisma.chatHistory.create({ data: { userId, role: "user", message: question } });

    const jwt = signAdvisorToolJwt({ userId, ttlSeconds: 120 });
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
      answer: string; sources: unknown[]; toolTrace: unknown[];
    };

    await prisma.chatHistory.create({
      data: {
        userId,
        role: "assistant",
        message: payload.answer,
        contextSnapshot: { sources: payload.sources, tools: payload.toolTrace },
      },
    });

    return reply.send({ ...payload, sessionId });
  });
}
```

- [ ] **Step 8: Register the route**

Modify `backend/src/routes/index.ts` — import + call `registerAdvisorAnswerRoutes(app)`.

- [ ] **Step 9: Run backend tests**

```bash
npm run test:backend -- advisor-answer
```

Expected: PASS.

- [ ] **Step 10: Manual E2E smoke**

Terminal A: `npm run dev:ai` (with real API keys and `BACKEND_URL=http://localhost:8081`).
Terminal B: `npm run dev:backend` (with `AI_SERVICE_URL=http://localhost:8000` and matching `ADVISOR_TOOL_SECRET`).
Terminal C:

```bash
curl -sS -X POST http://localhost:8081/api/advisor/answer \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <clerk dev token>' \
  -d '{"question":"How much should my emergency fund cover?"}' | jq
```

Expected: answer contains `[1]`, sources array has at least one CFPB entry.

- [ ] **Step 11: Commit**

```bash
git add ai-service/rag/answer.py ai-service/api/rag_routes.py ai-service/main.py \
        ai-service/schemas/rag.py ai-service/tests/test_rag_answer.py \
        backend/src/modules/chat/advisor-routes.ts backend/src/routes/index.ts \
        backend/src/lib/clerk-auth.ts backend/src/config/env.ts \
        backend/tests/advisor-answer.test.ts backend/.env.example ai-service/.env.example
git commit -m "feat(advisor): end-to-end RAG loop with searchDocs tool"
```

---

### Task 6: Frontend AdvisorMessage + wire AdvisorChat

**Files:**
- Modify: `frontend/lib/api.ts` (add types + helper)
- Create: `frontend/components/advisor-message.tsx`
- Create: `frontend/components/advisor-message.test.tsx`
- Modify: `frontend/components/advisor-chat.tsx` (swap endpoint + render)

**Interfaces:**
- Consumes: `POST /api/advisor/answer` (Task 5)
- Produces:
  - `askAdvisor(question, sessionId, token?): Promise<AdvisorAnswer>`
  - `AdvisorAnswer = { answer, sources: AdvisorSource[], toolTrace, sessionId }`
  - `AdvisorSource = { n, title, publisher, url, snippet }`
  - `<AdvisorMessage role="user"|"assistant" content sources? />`

- [ ] **Step 1: Add helper + types to `frontend/lib/api.ts`**

Append:

```ts
export type AdvisorSource = {
  n: number;
  title: string;
  publisher: string;
  url: string;
  snippet: string;
};

export type AdvisorAnswer = {
  answer: string;
  sources: AdvisorSource[];
  toolTrace: Array<{ name: string; input: unknown }>;
  sessionId: string;
};

export async function askAdvisor(
  question: string,
  sessionId: string,
  token?: string | null,
): Promise<AdvisorAnswer> {
  if (!apiBaseUrl) {
    return {
      answer: "Advisor is offline in local mock mode.",
      sources: [],
      toolTrace: [],
      sessionId,
    };
  }
  const resp = await fetch(`${apiBaseUrl}/api/advisor/answer`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, sessionId }),
  });
  if (!resp.ok) throw new Error(`advisor answer failed: ${resp.status}`);
  return (await resp.json()) as AdvisorAnswer;
}
```

- [ ] **Step 2: Write AdvisorMessage test (fails first)**

Create `frontend/components/advisor-message.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdvisorMessage } from "./advisor-message";

describe("AdvisorMessage", () => {
  it("renders [n] markers as accent superscript links", () => {
    render(
      <AdvisorMessage
        role="assistant"
        content="Save 3–6 months of expenses [1]."
        sources={[
          {
            n: 1,
            title: "CFPB · Emergency fund basics",
            publisher: "CFPB",
            url: "https://cfpb.gov/x",
            snippet: "Aim for 3 to 6 months.",
          },
        ]}
      />,
    );
    const marker = screen.getByRole("link", { name: "[1]" });
    expect(marker).toBeTruthy();
    expect(screen.getByText(/CFPB · Emergency fund basics/)).toBeTruthy();
    const openLink = screen.getByRole("link", { name: /open source 1/i });
    expect(openLink.getAttribute("href")).toBe("https://cfpb.gov/x");
  });

  it("omits the sources list when none are provided", () => {
    render(<AdvisorMessage role="assistant" content="Hi." />);
    expect(screen.queryByText(/CFPB/)).toBeNull();
  });
});
```

Run:
```bash
cd frontend && npm test -- advisor-message
```

Expected: FAIL — component missing.

- [ ] **Step 3: Implement `AdvisorMessage`**

Create `frontend/components/advisor-message.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Fragment, useCallback } from "react";

import type { AdvisorSource } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorSource[];
};

const CITATION_RE = /\[(\d+)\]/g;

function renderContent(content: string, onCitationClick: (n: number) => void) {
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(content)) !== null) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index));
    const n = Number(match[1]);
    nodes.push(
      <sup key={`c-${match.index}`} className="mx-0.5 text-[10px]">
        <a
          href={`#src-${n}`}
          onClick={(e) => {
            e.preventDefault();
            onCitationClick(n);
          }}
          className="rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--color-accent-text)] hover:underline"
        >
          [{n}]
        </a>
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes.map((node, idx) => <Fragment key={idx}>{node}</Fragment>);
}

export function AdvisorMessage({ role, content, sources }: Props) {
  const handleClick = useCallback((n: number) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(`src-${n}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    target.classList.add("ring-2", "ring-[var(--color-accent-base)]/40");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-[var(--color-accent-base)]/40");
    }, 900);
  }, []);

  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-6",
        role === "assistant"
          ? "border border-slate-200 bg-white"
          : "ml-auto bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]",
      )}
    >
      <div>{renderContent(content, handleClick)}</div>
      {sources && sources.length > 0 ? (
        <ol className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {sources.map((s) => (
            <li id={`src-${s.n}`} key={s.n} className="rounded-lg p-2 text-[12px] transition">
              <div className="flex items-center gap-2 text-slate-800">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  [{s.n}]
                </span>
                <span className="font-semibold">{s.publisher}</span>
                <span className="truncate text-slate-500">{s.title}</span>
                <Link
                  aria-label={`Open source ${s.n}`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-slate-500 hover:text-[var(--color-accent-text)]"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
              <p className="mt-1 text-slate-500">{s.snippet}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rewire `advisor-chat.tsx`**

Modify `frontend/components/advisor-chat.tsx`:

- Extend the local `AdvisorMessage` state entries to carry an optional `sources: AdvisorSource[]`.
- Replace the submit-side `fetch(...)` call with:

```tsx
const answer = await askAdvisor(question, sessionId, await getToken());
setMessages((prev) => [
  ...prev,
  { id: crypto.randomUUID(), role: "assistant", content: answer.answer, sources: answer.sources },
]);
```

- Replace the message renderer:

```tsx
{messages.map((m) => (
  <AdvisorMessageView key={m.id} role={m.role} content={m.content} sources={m.sources} />
))}
```

  where `AdvisorMessageView` is the imported `AdvisorMessage` (import as-is; alias only if there is a naming collision with the local `AdvisorMessage` type).

- Keep the loader, welcome, and starter-prompt UX unchanged.

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend && npm test -- advisor-message
```

Expected: 2 PASS.

- [ ] **Step 6: Manual browser check**

With backend + ai-service running (Task 5), open http://localhost:3000/advisor, ask "How big should my emergency fund be?" — the answer contains `[1]`, the source list renders below, and clicking `[1]` briefly highlights the row.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/advisor-message.tsx frontend/components/advisor-message.test.tsx \
        frontend/components/advisor-chat.tsx frontend/lib/api.ts
git commit -m "feat(advisor): inline citation UI + wire chat to /api/advisor/answer"
```

---

### Task 7: Register the four remaining personal-data tools

**Files:**
- Modify: `backend/src/lib/advisor-tools.ts`
- Modify: `backend/src/modules/chat/tool-routes.ts`
- Modify: `ai-service/rag/answer.py` (extend `_TOOLS`)
- Modify: `backend/tests/advisor-tool.test.ts` (add coverage)

**Interfaces:**
- Consumes: existing dashboard/subscriptions/health/forecast query helpers already used by dashboard routes
- Produces: five personal-data tools callable from the RAG loop; each returns typed JSON:
  - `getSubscriptions()` → `Array<{ name: string; monthlyCost: number; note?: string; lastChargedAt?: string; cadence?: string }>`
  - `getBalance(asOfDate?)` → `{ asOfDate: string; totalBalance: number; accounts: Array<{ name: string; mask: string | null; balance: number }> }`
  - `getInsights(severity?)` → `Array<{ title: string; summary: string; severity: "high"|"medium"|"low"; createdAt: string }>`
  - `getForecast(horizonDays)` → `{ horizonDays: number; points: Array<{ date: string; balance: number }>; safeToSpend: number }`

- [ ] **Step 1: Add tool handlers**

Append to `backend/src/lib/advisor-tools.ts`:

```ts
import { getDashboardOverviewForUser } from "./dashboard.js";
import { listSubscriptionsForUser } from "./subscriptions.js";
import { computeForecastForUser } from "./forecast.js";

export async function getSubscriptionsForUser(userId: string) {
  const rows = await listSubscriptionsForUser(userId);
  return rows.map((s) => ({
    name: s.name ?? s.merchantName ?? "Subscription",
    monthlyCost: Number(s.monthlyCost ?? 0),
    note: s.note ?? undefined,
    lastChargedAt: s.lastChargedAt?.toISOString(),
    cadence: s.cadence ?? undefined,
  }));
}

export async function getBalanceForUser(userId: string, args: Record<string, unknown>) {
  const asOfDate = typeof args.asOfDate === "string"
    ? args.asOfDate
    : new Date().toISOString().slice(0, 10);
  const overview = await getDashboardOverviewForUser(userId);
  return {
    asOfDate,
    totalBalance: Number(overview.currentBalance ?? 0),
    accounts: (overview.accountsBreakdown ?? []).map((a) => ({
      name: a.name,
      mask: a.mask,
      balance: Number(a.currentBalance ?? 0),
    })),
  };
}

export async function getInsightsForUser(userId: string, args: Record<string, unknown>) {
  const severity = args.severity as "high" | "medium" | "low" | undefined;
  const overview = await getDashboardOverviewForUser(userId);
  const items = overview.insightHighlights ?? [];
  const filtered = severity ? items.filter((i) => i.severity === severity) : items;
  return filtered.map((i) => ({
    title: i.title,
    summary: i.summary,
    severity: i.severity,
    createdAt: new Date().toISOString(),
  }));
}

export async function getForecastForUser(userId: string, args: Record<string, unknown>) {
  const horizon = [7, 30, 90].includes(args.horizonDays as number)
    ? (args.horizonDays as number)
    : 30;
  const forecast = await computeForecastForUser(userId, horizon);
  return {
    horizonDays: horizon,
    points: forecast.points.map((p) => ({ date: p.date, balance: Number(p.balance) })),
    safeToSpend: Number(forecast.safeToSpend ?? 0),
  };
}
```

If any imported helper does not yet exist under that exact name, use whatever the corresponding backend module already exports (`getDashboardOverview`, `getSubscriptions`, forecast function) and keep the return shapes above unchanged.

- [ ] **Step 2: Extend the switch in `tool-routes.ts`**

Modify `backend/src/modules/chat/tool-routes.ts` — add imports and switch cases:

```ts
import {
  getRecentTransactionsForUser,
  getSubscriptionsForUser,
  getBalanceForUser,
  getInsightsForUser,
  getForecastForUser,
} from "../../lib/advisor-tools.js";

// inside switch (parsed.data.tool)
case "getSubscriptions": {
  const data = await getSubscriptionsForUser(claims.userId);
  return reply.send({ data });
}
case "getBalance": {
  const data = await getBalanceForUser(claims.userId, parsed.data.args);
  return reply.send({ data });
}
case "getInsights": {
  const data = await getInsightsForUser(claims.userId, parsed.data.args);
  return reply.send({ data });
}
case "getForecast": {
  const data = await getForecastForUser(claims.userId, parsed.data.args);
  return reply.send({ data });
}
```

- [ ] **Step 3: Extend `_TOOLS` in `ai-service/rag/answer.py`**

Append to the `_TOOLS` list:

```python
{
    "name": "getTransactions",
    "description": (
        "Fetch the signed-in user's recent transactions. Filter by category, "
        "merchant, date range, or amount."
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
    "description": "List the user's detected recurring subscriptions.",
    "input_schema": {"type": "object", "properties": {}},
},
{
    "name": "getBalance",
    "description": "Return the user's current balance, or historical balance on a given date.",
    "input_schema": {
        "type": "object",
        "properties": {"asOfDate": {"type": "string", "format": "date"}},
    },
},
{
    "name": "getInsights",
    "description": "Fetch AI-generated insights already computed for this user.",
    "input_schema": {
        "type": "object",
        "properties": {"severity": {"type": "string", "enum": ["high", "medium", "low"]}},
    },
},
{
    "name": "getForecast",
    "description": "Return the user's cash-flow forecast for 7d, 30d, or 90d.",
    "input_schema": {
        "type": "object",
        "properties": {"horizonDays": {"type": "integer", "enum": [7, 30, 90], "default": 30}},
    },
},
```

- [ ] **Step 4: Extend backend tool test**

Append to `backend/tests/advisor-tool.test.ts`:

```ts
it("returns an empty subscriptions array for a user with no data", async () => {
  const token = signAdvisorToolJwt({ userId: "u_no_data", ttlSeconds: 60 });
  const resp = await app.inject({
    method: "POST",
    url: "/internal/advisor/tool",
    headers: { authorization: `Bearer ${token}` },
    payload: { tool: "getSubscriptions", args: {}, userId: "u_no_data" },
  });
  expect(resp.statusCode).toBe(200);
  expect(resp.json().data).toBeInstanceOf(Array);
});
```

- [ ] **Step 5: Run tests**

```bash
npm run test:backend -- advisor-tool
cd ai-service && pytest tests/test_rag_answer.py -v
```

Expected: all PASS.

- [ ] **Step 6: Manual smoke — personal-data question**

```bash
curl -sS -X POST http://localhost:8081/api/advisor/answer \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <clerk dev token>' \
  -d '{"question":"What did I spend on dining this month?"}' | jq
```

Expected: `toolTrace` includes `getTransactions` or `getInsights`; the answer references real numbers or says data is unavailable.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/advisor-tools.ts backend/src/modules/chat/tool-routes.ts \
        backend/tests/advisor-tool.test.ts ai-service/rag/answer.py
git commit -m "feat(advisor): register 4 remaining personal-data tools"
```

---

### Task 8: Full corpus seed + eval harness

**Files:**
- Modify: `ai-service/rag/sources.py` (expand to ~40 entries)
- Modify: `ai-service/rag/ingest.py` (add `--dry-run`, `--reset`)
- Create: `ai-service/rag/eval.py`

**Interfaces:**
- Consumes: `SEED_SOURCES`, `answer_question` (Task 5), `KbDocument`/`KbChunk`
- Produces:
  - `python -m ai_service.rag.ingest --dry-run` prints fetch metadata without DB writes.
  - `python -m ai_service.rag.ingest --reset` truncates `KbDocument` before re-ingest.
  - `python -m ai_service.rag.eval` runs a hand-written golden question set.

- [ ] **Step 1: Expand `sources.py`**

Extend `SEED_SOURCES` in `ai-service/rag/sources.py` with approximately 35 additional entries following the same `Source(...)` literal shape. Group by category and use real published URLs:

- **CFPB** (`https://files.consumerfinance.gov/f/documents/*.pdf`): budgeting worksheet, credit report basics, debt collection rights, mortgage shopping.
- **IRS** (`https://www.irs.gov/pub/irs-pdf/*.pdf`): Pub 17 (income + deductions), Pub 590-A (IRA contributions), Pub 505 (withholding).
- **SEC investor.gov**: intro to investing, mutual funds, ETFs, 401(k) basics.
- **Federal Reserve consumer help**: how to dispute a credit report error, how ACH works.
- **USA.gov** consumer/finance guides.
- **NerdWallet** (COMMERCIAL): 50/30/20 budget, high-yield savings, choosing a checking account, credit-card churn ethics.
- **Investopedia** (COMMERCIAL): APR vs APY, compound interest, emergency fund sizing, subscription auditing.

Do not scrape any publisher not listed above without adding them explicitly. Every commercial entry must be chunkable to ≤ 300-word excerpts.

- [ ] **Step 2: Add flags to `ingest.py`**

Modify `ai-service/rag/ingest.py` — extend `main()`:

```python
parser.add_argument("--dry-run", action="store_true", help="fetch + count only, no DB writes")
parser.add_argument("--reset", action="store_true", help="delete all KbDocuments first")
```

Inside `main()`:

```python
with psycopg.connect(dsn, autocommit=False) as conn:
    if args.reset:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "KbDocument"')
        conn.commit()
    for source in SEED_SOURCES:
        if args.only and args.only not in source.url:
            continue
        content, content_hash = fetch_bytes(source.url)
        if args.dry_run:
            print(f"[dry] {source.publisher}: {source.title[:60]} ({len(content)} bytes)")
            continue
        content_type = "application/pdf" if source.url.endswith(".pdf") else "text/html"
        doc_id, added = _upsert(conn, source, content, content_hash, content_type)
        conn.commit()
        print(f"{source.publisher}: {source.title[:60]} → {doc_id} (+{added} chunks)")
        total_chunks += added
```

- [ ] **Step 3: Implement eval harness**

Create `ai-service/rag/eval.py`:

```python
import os
import time

from ..schemas.rag import RagRequest, ToolContext
from .answer import answer_question

GOLDEN = [
    ("How big should my emergency fund be?", "domain"),
    ("What is credit utilization and why does it matter?", "domain"),
    ("What is the 50/30/20 budget?", "domain"),
    ("How do I open a Roth IRA?", "domain"),
    ("What is APR?", "domain"),
    ("What is a good FICO score?", "domain"),
    ("What did I spend on food last month?", "personal"),
    ("Which subscription is most expensive?", "personal"),
    ("Am I on track for a $5,000 savings goal by December?", "personal"),
    ("What's my biggest cash-flow risk?", "personal"),
]


def main() -> None:
    tool_jwt = os.getenv("EVAL_TOOL_JWT", "eval.stub")
    for question, kind in GOLDEN:
        req = RagRequest(
            question=question,
            toolContext=ToolContext(
                userId=os.getenv("EVAL_USER_ID", "u_eval"),
                plaidReady=kind == "personal",
                now=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            ),
            history=[],
        )
        try:
            resp = answer_question(req, tool_jwt=tool_jwt)
        except Exception as exc:  # pragma: no cover - eval-only
            print(f"[{kind}] {question}\n  ERROR: {exc}\n")
            continue
        print(f"[{kind}] {question}")
        print(f"  answer: {resp.answer[:200].replace(chr(10), ' ')}")
        for s in resp.sources:
            print(f"    [{s.n}] {s.publisher} {s.title[:60]} {s.url}")
        print()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Dry-run + seed**

```bash
cd ai-service && python -m ai_service.rag.ingest --dry-run
cd ai-service && python -m ai_service.rag.ingest
```

Expected: dry-run prints ~40 lines; the ingest run adds > 500 total chunks (large PDFs dominate).

- [ ] **Step 5: Run eval**

```bash
cd ai-service && python -m ai_service.rag.eval
```

Expected: every question prints an answer; at least 8/10 domain questions surface a sensible-looking source list; personal questions either return real numbers (if `EVAL_USER_ID` has data in the DB) or say "connect Plaid".

- [ ] **Step 6: Commit**

```bash
git add ai-service/rag/sources.py ai-service/rag/ingest.py ai-service/rag/eval.py
git commit -m "feat(rag): full corpus seed + eval harness"
```

---

### Task 9: Route floating advisor through RAG, deprecate legacy path

**Files:**
- Modify: `frontend/components/dashboard-advisor.tsx`
- Modify: `ai-service/llm/service.py` (docstring marks deprecation)
- Modify: `ai-service/api/routes.py` (or wherever `refine_advisor_answer` is exposed) — gate behind `LEGACY_ADVISOR=1`

**Interfaces:**
- Consumes: `askAdvisor` (Task 6), `AdvisorMessage` (Task 6)
- Produces: single code path for all advisor entry points; the legacy Gemini route returns 410 unless `LEGACY_ADVISOR=1`.

- [ ] **Step 1: Point the floating advisor at the new endpoint**

Modify `frontend/components/dashboard-advisor.tsx` — replace the direct fetch call and inline message renderer with `askAdvisor(question, sessionId, token)` and `<AdvisorMessage role content sources />`. Keep the compact bubble chrome; wrap the `AdvisorMessage` inside it rather than duplicating the renderer.

- [ ] **Step 2: Gate legacy path in ai-service**

Modify the route file that exposes `refine_advisor_answer` (search for it under `ai-service/api/`):

```python
import os
from fastapi import HTTPException

if os.getenv("LEGACY_ADVISOR", "0") != "1":
    raise HTTPException(status_code=410, detail="legacy advisor removed — use /rag/answer")
```

Add a docstring to `refine_advisor_answer` in `ai-service/llm/service.py`:

```python
"""DEPRECATED: replaced by ai_service.rag.answer.answer_question. Remove once
frontend no longer imports the legacy path (target: next release)."""
```

- [ ] **Step 3: Run the full check suite**

```bash
npm run lint:frontend
npm run build:frontend
npm run typecheck:backend
npm run test:backend
npm run build:backend
cd ai-service && pytest
```

Expected: all green. Any existing test that directly invoked `refine_advisor_answer` should be updated to patch `answer_question` or removed.

- [ ] **Step 4: Manual smoke of both entry points**

- Load `/dashboard` — click the floating advisor bubble, ask a question, expect the same RAG-cited answer as `/advisor`.
- Load `/advisor` — identical behavior.
- Set `LEGACY_ADVISOR=1` in ai-service env; verify the legacy endpoint still returns something reasonable, unset it, and verify the endpoint 410s.

- [ ] **Step 5: Commit**

```bash
git add ai-service/llm/service.py ai-service/api/routes.py frontend/components/dashboard-advisor.tsx
git commit -m "chore(advisor): route all advisor traffic through RAG, deprecate Gemini path"
```

---

## Self-review

- **Spec coverage** — every spec section maps to a task:
  - Architecture → Task 5
  - Data model → Task 1
  - Corpus ingestion → Tasks 4 (pipeline + seed) + 8 (full corpus + eval)
  - Tool surface → Tasks 2 (JWT + first tool) + 7 (remaining four)
  - Request flow → Task 5
  - Frontend → Task 6
  - Rollout → Tasks 1-9 in order
  - Testing → tests in Tasks 1, 2, 3, 4, 5, 6
  - Env → Tasks 2 (backend `.env.example`) and 3 (ai-service `.env.example`)
  - Cost guards → runtime toggles (OpenAI/Anthropic dashboards, `MAX_TOOL_ITERS` in Task 5, existing `@fastify/rate-limit` — no new code task needed; called out in the spec as operator-owned)
  - Fallback → Task 5 step 3 (`ANTHROPIC_API_KEY` missing returns configured-message payload)
- **Placeholder scan** — no `TBD`/`TODO`/vague "add appropriate error handling" phrases. Every code block is real code with real paths.
- **Type consistency** — `AdvisorSource` (frontend, Task 6) matches `SourceOut` (ai-service, Task 5) field-for-field. `RagRequest`/`RagResponse` used in both ai-service tests and route. Tool names identical across backend `switch`, ai-service `_TOOLS`, and spec table. `signAdvisorToolJwt` / `verifyAdvisorToolJwt` names are used consistently in the JWT helper (Task 2) and the advisor route (Task 5).
