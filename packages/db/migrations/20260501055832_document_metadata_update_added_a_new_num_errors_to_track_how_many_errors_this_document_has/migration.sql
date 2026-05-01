-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "numErrors" INTEGER NOT NULL DEFAULT 0;
