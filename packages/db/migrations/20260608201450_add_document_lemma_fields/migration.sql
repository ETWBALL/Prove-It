-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "DocumentLemma" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "hintContent" TEXT DEFAULT '',
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "wasUsed" BOOLEAN NOT NULL DEFAULT false;
