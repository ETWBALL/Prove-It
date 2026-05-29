-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Error" ADD COLUMN     "errorMessage" TEXT;

-- AlterTable
ALTER TABLE "Lemma" ALTER COLUMN "content" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "MathStatement" ALTER COLUMN "content" SET DATA TYPE TEXT;
