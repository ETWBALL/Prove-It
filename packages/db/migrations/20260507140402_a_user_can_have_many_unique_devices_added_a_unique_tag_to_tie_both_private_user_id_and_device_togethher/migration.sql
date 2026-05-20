/*
  Warnings:

  - A unique constraint covering the columns `[privateUserId,device]` on the table `Sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- CreateIndex
CREATE UNIQUE INDEX "Sessions_privateUserId_device_key" ON "Sessions"("privateUserId", "device");
