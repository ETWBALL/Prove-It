/*
  Warnings:

  - Added the required column `provingStatement` to the `DocumentBody` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "DocumentBody" ADD COLUMN     "provingStatement" TEXT NOT NULL;
