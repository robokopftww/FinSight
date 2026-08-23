import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("KB schema", () => {
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
