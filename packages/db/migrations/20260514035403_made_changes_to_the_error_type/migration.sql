/*
  Warnings:

  - The values [INCORRECTLY_NEGATING_A_STATEMENT,MISSING_JUSTIFICATION] on the enum `ErrorType` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `DocumentMathStatements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `privateHintId` on the `DocumentMathStatements` table. All the data in the column will be lost.
  - You are about to drop the `Hint` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ErrorType_new" AS ENUM ('INCORRECT_NEGATION', 'ASSUMING_THE_CONVERSE', 'EQUIVOCATION', 'FALSE_DICHOTOMY_IN_CASE_ANALYSIS', 'UNJUSTIFIED_REVERSIBILITY', 'MISAPPLYING_A_THEOREM', 'MISAPPLYING_A_DEFINITION', 'MISAPPLYING_A_LEMMA', 'MISAPPLYING_A_PROPERTY', 'MISAPPLYING_AN_AXIOM', 'MISAPPLYING_A_COROLLARY', 'MISAPPLYING_A_CONJECTURE', 'MISAPPLYING_A_PROPOSITION', 'AFFIRMING_THE_CONSEQUENT', 'CIRCULAR_REASONING', 'JUMPING_TO_CONCLUSIONS', 'IMPROPER_GENERALIZATION', 'IMPLICIT_ASSUMPTION', 'CONTRADICTS_PREVIOUS_STATEMENT', 'SCOPE_ERROR', 'NON_SEQUITUR', 'VACUOUS_PROOF_FALLACY', 'EXISTENTIAL_INSTANTIATION_ERROR', 'ASSUMING_THE_GOAL', 'VARIABLE_SHADOWING', 'PROOF_BY_EXAMPLE', 'ILLEGAL_OPERATION', 'VACUOUS_NEGATION', 'STRUCTURE_ERROR', 'INFORMAL_LANGUAGE', 'AMBIGUOUS_PRONOUN', 'MISSING_PUNCTUATION', 'INCOMPLETE_SENTENCE', 'MISSING_DEFINITION_UNFOLD', 'UNEXPANDED_ACRONYM', 'INCONSISTENT_NOTATION', 'UNDEFINED_TERM_USED', 'MISSING_QUANTIFIER', 'WRONG_LOGICAL_CONNECTIVE', 'REDUNDANT_STATEMENT', 'TYPE_MISMATCH', 'DANGLING_VARIABLE', 'SYMBOL_AS_VERB', 'UNFOLDING_FAILURE');
ALTER TABLE "Error" ALTER COLUMN "type" TYPE "ErrorType_new" USING ("type"::text::"ErrorType_new");
ALTER TYPE "ErrorType" RENAME TO "ErrorType_old";
ALTER TYPE "ErrorType_new" RENAME TO "ErrorType";
DROP TYPE "public"."ErrorType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_privateHintId_fkey";

-- DropForeignKey
ALTER TABLE "Hint" DROP CONSTRAINT "Hint_privateDocumentId_fkey";

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_pkey",
DROP COLUMN "privateHintId",
ADD COLUMN     "hint" TEXT,
ADD CONSTRAINT "DocumentMathStatements_pkey" PRIMARY KEY ("privateDocumentId", "privateMathStatementId");

-- DropTable
DROP TABLE "Hint";
