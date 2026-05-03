/*
  Warnings:

  - The primary key for the `DocumentMathStatements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `privateHintId` on the `DocumentMathStatements` table. All the data in the column will be lost.
  - You are about to drop the column `hintsPerDefLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the `Hint` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `privateSuggestionId` to the `DocumentMathStatements` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_privateHintId_fkey";

-- DropForeignKey
ALTER TABLE "Hint" DROP CONSTRAINT "Hint_privateDocumentId_fkey";

-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "DocumentMathStatements" DROP CONSTRAINT "DocumentMathStatements_pkey",
DROP COLUMN "privateHintId",
ADD COLUMN     "privateSuggestionId" INTEGER NOT NULL,
ADD CONSTRAINT "DocumentMathStatements_pkey" PRIMARY KEY ("privateDocumentId", "privateMathStatementId", "privateSuggestionId");

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "hintsPerDefLimit";

-- DropTable
DROP TABLE "Hint";

-- CreateTable
CREATE TABLE "Suggestion" (
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

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("privateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_publicId_key" ON "Suggestion"("publicId");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMathStatements" ADD CONSTRAINT "DocumentMathStatements_privateSuggestionId_fkey" FOREIGN KEY ("privateSuggestionId") REFERENCES "Suggestion"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;
