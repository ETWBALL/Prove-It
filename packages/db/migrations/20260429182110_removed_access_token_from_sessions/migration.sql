/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Sessions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Sessions_accessToken_key";

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Sessions" DROP COLUMN "accessToken";
