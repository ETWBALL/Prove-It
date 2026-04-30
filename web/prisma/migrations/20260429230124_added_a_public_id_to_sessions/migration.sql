/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Sessions` will be added. If there are existing duplicate values, this will fail.
  - The required column `publicId` was added to the `Sessions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Sessions" ADD COLUMN     "publicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sessions_publicId_key" ON "Sessions"("publicId");
