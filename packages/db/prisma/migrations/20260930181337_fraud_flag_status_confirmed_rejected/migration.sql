-- AlterEnum
-- The generated USING cast fails on existing 'reviewed' rows — that value does not exist
-- in the new type. Mapping them to 'rejected' is the intended data migration.
BEGIN;
CREATE TYPE "FraudFlagStatus_new" AS ENUM ('open', 'confirmed', 'rejected');
ALTER TABLE "public"."fraud_flags" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "fraud_flags" ALTER COLUMN "status" TYPE "FraudFlagStatus_new"
  USING (CASE WHEN "status"::text = 'reviewed' THEN 'rejected' ELSE "status"::text END)::"FraudFlagStatus_new";
ALTER TYPE "FraudFlagStatus" RENAME TO "FraudFlagStatus_old";
ALTER TYPE "FraudFlagStatus_new" RENAME TO "FraudFlagStatus";
DROP TYPE "public"."FraudFlagStatus_old";
ALTER TABLE "fraud_flags" ALTER COLUMN "status" SET DEFAULT 'open';
COMMIT;
