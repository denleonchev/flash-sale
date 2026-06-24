-- Enable pgvector extension (required for vector(384) type)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "embedding" vector(384),
ALTER COLUMN "price_cents" DROP DEFAULT;

-- HNSW index for cosine similarity search (FR-26)
CREATE INDEX sales_embedding_hnsw
  ON sales USING hnsw (embedding vector_cosine_ops);
