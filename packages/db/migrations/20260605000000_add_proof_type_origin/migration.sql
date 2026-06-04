-- CreateEnum
CREATE TYPE "ProofTypeOrigin" AS ENUM ('UNDETECTED', 'DETECTED', 'USER_SET');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "proofTypeOrigin" "ProofTypeOrigin" NOT NULL DEFAULT 'UNDETECTED';
