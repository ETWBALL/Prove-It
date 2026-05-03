/*
  Warnings:

  - The primary key for the `DocumentMathStatements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `privateSuggestionId` on the `DocumentMathStatements` table. All the data in the column will be lost.
  - You are about to drop the column `endIndex` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the column `startIndex` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedFix` on the `Error` table. All the data in the column will be lost.
  - You are about to drop the `Suggestion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `privateHintId` to the `DocumentMathStatements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endIndexError` to the `Error` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endIndexSuggestion` to the `Error` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startIndexError` to the `Error` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startIndexSuggestion` to the `Error` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hintsPerDefLimit` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_privateSuggestionId_fkey";

-- DropForeignKey
ALTER TABLE "Suggestion" DROP CONSTRAINT "Suggestion_privateDocumentId_fkey";

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_pkey",
DROP COLUMN "privateSuggestionId",
ADD COLUMN     "privateHintId" INTEGER NOT NULL,
ADD CONSTRAINT "DocumentMathStatements_pkey" PRIMARY KEY ("privateDocumentId", "privateMathStatementId", "privateHintId");

-- AlterTable
ALTER TABLE "Error" DROP COLUMN "endIndex",
DROP COLUMN "startIndex",
DROP COLUMN "suggestedFix",
ADD COLUMN     "contentSuggestion" TEXT,
ADD COLUMN     "endIndexError" INTEGER NOT NULL,
ADD COLUMN     "endIndexSuggestion" INTEGER NOT NULL,
ADD COLUMN     "startIndexError" INTEGER NOT NULL,
ADD COLUMN     "startIndexSuggestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "hintsPerDefLimit" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Suggestion";

-- CreateTable
CREATE TABLE "Hint" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "privateDocumentId" INTEGER NOT NULL,
    "content" JSONB,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hint_pkey" PRIMARY KEY ("privateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hint_publicId_key" ON "Hint"("publicId");

-- AddForeignKey
ALTER TABLE "Hint" ADD CONSTRAINT "Hint_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMathStatements" ADD CONSTRAINT "DocumentMathStatements_privateHintId_fkey" FOREIGN KEY ("privateHintId") REFERENCES "Hint"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;
