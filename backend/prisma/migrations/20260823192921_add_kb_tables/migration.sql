CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KbSource" AS ENUM ('GOV', 'COMMERCIAL');

-- CreateTable
CREATE TABLE "KbDocument" (
    "id" TEXT NOT NULL,
    "source" "KbSource" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "KbDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KbDocument_url_key" ON "KbDocument"("url");

-- CreateIndex
CREATE INDEX "KbChunk_documentId_order_idx" ON "KbChunk"("documentId", "order");

-- AddForeignKey
ALTER TABLE "KbChunk" ADD CONSTRAINT "KbChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KbDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX kb_chunk_embedding_ivfflat_idx
  ON "KbChunk" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
