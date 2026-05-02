/*
  Warnings:

  - You are about to drop the column `contentSuggestion` on the `Error` table. All the data in the column will be lost.
  - Added the required column `errorContent` to the `Error` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Error" DROP COLUMN "contentSuggestion",
ADD COLUMN     "errorContent" TEXT NOT NULL,
ADD COLUMN     "suggestionContent" TEXT;
