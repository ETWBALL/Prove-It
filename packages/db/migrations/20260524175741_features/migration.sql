/*
  Warnings:

  - Added the required column `provability` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Provability" AS ENUM ('PROVABLE', 'UNPROVABLE', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "ProofStatus" ADD VALUE 'FAILED_COMPILATION';

-- AlterEnum
ALTER TYPE "Sufficiency" ADD VALUE 'UNCHECKED';

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "provability" "Provability" NOT NULL;
