-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "strictnessMathStatements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "strictnessProofType" BOOLEAN NOT NULL DEFAULT false;
