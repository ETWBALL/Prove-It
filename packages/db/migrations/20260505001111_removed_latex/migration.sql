/*
  Warnings:

  - The values [LATEX_PARSER,COMPUTATION] on the enum `ValidationLayer` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `model` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `Error` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ErrorType" ADD VALUE 'INFORMAL_LANGUAGE';
ALTER TYPE "ErrorType" ADD VALUE 'AMBIGUOUS_PRONOUN';
ALTER TYPE "ErrorType" ADD VALUE 'MISSING_PUNCTUATION';
ALTER TYPE "ErrorType" ADD VALUE 'INCOMPLETE_SENTENCE';
ALTER TYPE "ErrorType" ADD VALUE 'MISSING_DEFINITION_UNFOLD';
ALTER TYPE "ErrorType" ADD VALUE 'UNEXPANDED_ACRONYM';
ALTER TYPE "ErrorType" ADD VALUE 'INCONSISTENT_NOTATION';
ALTER TYPE "ErrorType" ADD VALUE 'UNDEFINED_TERM_USED';
ALTER TYPE "ErrorType" ADD VALUE 'MISSING_QUANTIFIER';
ALTER TYPE "ErrorType" ADD VALUE 'IMPLICIT_ASSUMPTION';
ALTER TYPE "ErrorType" ADD VALUE 'MISSING_JUSTIFICATION';

-- AlterEnum
BEGIN;
CREATE TYPE "ValidationLayer_new" AS ENUM ('PROOF_GRAMMER', 'LOGIC_CHAIN');
ALTER TABLE "Error" ALTER COLUMN "layer" TYPE "ValidationLayer_new" USING ("layer"::text::"ValidationLayer_new");
ALTER TABLE "Plan" ALTER COLUMN "errorVisibility" TYPE "ValidationLayer_new" USING ("errorVisibility"::text::"ValidationLayer_new");
ALTER TYPE "ValidationLayer" RENAME TO "ValidationLayer_old";
ALTER TYPE "ValidationLayer_new" RENAME TO "ValidationLayer";
DROP TYPE "public"."ValidationLayer_old";
COMMIT;

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Error" DROP COLUMN "model",
DROP COLUMN "severity";

-- DropEnum
DROP TYPE "Severity";
