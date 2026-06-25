-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('open', 'reviewed');

-- AlterTable
ALTER TABLE "fraud_flags" ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "status" "FraudFlagStatus" NOT NULL DEFAULT 'open';
