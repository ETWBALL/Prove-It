/*
  Warnings:

  - The values [LEMMA] on the enum `Library` will be removed. If these variants are still used in the database, this will fail.
  - The values [PROOF_GRAMMER] on the enum `ValidationLayer` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `numErrors` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `hint` on the `DocumentMathStatements` table. All the data in the column will be lost.
  - You are about to drop the column `errorContent` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the column `problematicContent` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the column `hint` on the `MathStatement` table. All the data in the column will be lost.
  - You are about to drop the column `hintsPerDefLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `suggestionLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the `userCourse` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `status` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `content` on the `MathStatement` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `errorsLimit` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mathStatementsLimit` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `content` on the `ProofAttempt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `bio` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `avatarUrl` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "Sufficiency" AS ENUM ('INSUFFICIENT', 'SUFFICIENT');

-- AlterEnum
BEGIN;
CREATE TYPE "Library_new" AS ENUM ('DEFINITION', 'THEOREM', 'PROPERTY', 'AXIOM', 'COROLLARY', 'CONJECTURE', 'PROPOSITION');
ALTER TABLE "MathStatement" ALTER COLUMN "type" TYPE "Library_new" USING ("type"::text::"Library_new");
ALTER TYPE "Library" RENAME TO "Library_old";
ALTER TYPE "Library_new" RENAME TO "Library";
DROP TYPE "public"."Library_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ValidationLayer_new" AS ENUM ('PROOF_GRAMMAR', 'LOGIC_CHAIN');
ALTER TABLE "Error" ALTER COLUMN "layer" TYPE "ValidationLayer_new" USING ("layer"::text::"ValidationLayer_new");
ALTER TABLE "Plan" ALTER COLUMN "errorVisibility" TYPE "ValidationLayer_new" USING ("errorVisibility"::text::"ValidationLayer_new");
ALTER TYPE "ValidationLayer" RENAME TO "ValidationLayer_old";
ALTER TYPE "ValidationLayer_new" RENAME TO "ValidationLayer";
DROP TYPE "public"."ValidationLayer_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "userCourse" DROP CONSTRAINT "userCourse_privateCourseId_fkey";

-- DropForeignKey
ALTER TABLE "userCourse" DROP CONSTRAINT "userCourse_privateUserId_fkey";

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "numErrors",
ADD COLUMN     "status" "ProofStatus" NOT NULL;

-- AlterTable
ALTER TABLE "DocumentMathStatements" DROP COLUMN "hint",
ADD COLUMN     "hintContent" TEXT DEFAULT '',
ADD COLUMN     "sufficient" "Sufficiency" NOT NULL DEFAULT 'INSUFFICIENT';

-- AlterTable
ALTER TABLE "Error" DROP COLUMN "errorContent",
DROP COLUMN "problematicContent",
ALTER COLUMN "endIndexSuggestion" DROP NOT NULL,
ALTER COLUMN "startIndexSuggestion" DROP NOT NULL,
ALTER COLUMN "suggestionContent" SET DEFAULT '';

-- AlterTable
ALTER TABLE "MathStatement" DROP COLUMN "hint",
ADD COLUMN     "privateOwnerId" INTEGER,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL,
ALTER COLUMN "privateCourseId" DROP NOT NULL,
ALTER COLUMN "textbook" DROP NOT NULL,
ALTER COLUMN "orderIndex" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "hintsPerDefLimit",
DROP COLUMN "suggestionLimit",
ADD COLUMN     "errorsLimit" INTEGER NOT NULL,
ADD COLUMN     "mathStatementsLimit" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProofAttempt" DROP COLUMN "content",
ADD COLUMN     "content" JSONB NOT NULL,
ALTER COLUMN "versionName" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "bio" SET NOT NULL,
ALTER COLUMN "bio" SET DEFAULT '',
ALTER COLUMN "avatarUrl" SET NOT NULL,
ALTER COLUMN "avatarUrl" SET DEFAULT '';

-- DropTable
DROP TABLE "userCourse";

-- CreateTable
CREATE TABLE "DocumentLemma" (
    "privateDocumentId" INTEGER NOT NULL,
    "privateLemmaId" INTEGER NOT NULL,
    "lemmaStatus" "ProofStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "lemmaManualOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DocumentLemma_pkey" PRIMARY KEY ("privateDocumentId","privateLemmaId")
);

-- CreateTable
CREATE TABLE "Lemma" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "privateOwnerId" INTEGER,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "privateCourseId" INTEGER,
    "textbook" "Textbook",
    "orderIndex" INTEGER,
    "privateDocumentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lemma_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "UserCourse" (
    "privateUserId" INTEGER NOT NULL,
    "privateCourseId" INTEGER NOT NULL,
    "unenrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCourse_pkey" PRIMARY KEY ("privateUserId","privateCourseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lemma_publicId_key" ON "Lemma"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Lemma_privateDocumentId_key" ON "Lemma"("privateDocumentId");

-- AddForeignKey
ALTER TABLE "DocumentLemma" ADD CONSTRAINT "DocumentLemma_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLemma" ADD CONSTRAINT "DocumentLemma_privateLemmaId_fkey" FOREIGN KEY ("privateLemmaId") REFERENCES "Lemma"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MathStatement" ADD CONSTRAINT "MathStatement_privateOwnerId_fkey" FOREIGN KEY ("privateOwnerId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lemma" ADD CONSTRAINT "Lemma_privateOwnerId_fkey" FOREIGN KEY ("privateOwnerId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lemma" ADD CONSTRAINT "Lemma_privateCourseId_fkey" FOREIGN KEY ("privateCourseId") REFERENCES "Course"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lemma" ADD CONSTRAINT "Lemma_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourse" ADD CONSTRAINT "UserCourse_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourse" ADD CONSTRAINT "UserCourse_privateCourseId_fkey" FOREIGN KEY ("privateCourseId") REFERENCES "Course"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;
