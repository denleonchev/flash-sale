-- CreateTable
CREATE TABLE "fraud_flag_citations" (
    "flag_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "cited_flag_id" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "fraud_flag_citations_pkey" PRIMARY KEY ("flag_id","position")
);

-- CreateIndex
CREATE INDEX "fraud_flag_citations_cited_flag_id_idx" ON "fraud_flag_citations"("cited_flag_id");

-- AddForeignKey
ALTER TABLE "fraud_flag_citations" ADD CONSTRAINT "fraud_flag_citations_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "fraud_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_flag_citations" ADD CONSTRAINT "fraud_flag_citations_cited_flag_id_fkey" FOREIGN KEY ("cited_flag_id") REFERENCES "fraud_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
