/*
  Warnings:

  - A unique constraint covering the columns `[privateDocumentId]` on the table `DocumentBody` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBody_privateDocumentId_key" ON "DocumentBody"("privateDocumentId");
