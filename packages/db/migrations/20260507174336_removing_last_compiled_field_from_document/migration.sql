/*
  Warnings:

  - You are about to drop the column `lastCompiled` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "lastCompiled";
