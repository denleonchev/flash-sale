-- Hand-written: Prisma 7 has no hnsw index type, so these indexes cannot be declared in
-- schema.prisma and are invisible to its schema diff — a later `migrate dev` will offer
-- to DROP them. Create schema migrations with `pnpm migrate:new` (--create-only) and
-- strip that DropIndex before applying.

-- FR-26: semantic sale search orders by cosine distance (<=>), so the opclass must be
-- vector_cosine_ops — with any other class the planner ignores the index.
CREATE INDEX IF NOT EXISTS sales_embedding_hnsw
  ON sales USING hnsw (embedding vector_cosine_ops);

-- FR-27: fraud RAG orders by L2 distance (<->).
CREATE INDEX IF NOT EXISTS fraud_flags_embedding_hnsw
  ON fraud_flags USING hnsw (embedding vector_l2_ops);
