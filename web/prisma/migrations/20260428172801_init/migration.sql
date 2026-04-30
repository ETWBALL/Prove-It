-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('DIRECT', 'CONTRADICTION', 'CONTRAPOSITIVE', 'WEAK_INDUCTION', 'STRONG_INDUCTION', 'COUNTEREXAMPLE', 'STRUCTURAL_INDUCTION', 'BICONDITIONAL', 'CONDITIONAL', 'CASE_ANALYSIS');

-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('INCORRECTLY_NEGATING_A_STATEMENT', 'ASSUMING_THE_CONVERSE', 'EQUIVOCATION', 'FALSE_DICHOTOMY_IN_CASE_ANALYSIS', 'UNJUSTIFIED_REVERSIBILITY', 'MISAPPLYING_A_THEOREM', 'MISAPPLYING_A_DEFINITION', 'MISAPPLYING_A_LEMMA', 'MISAPPLYING_A_PROPERTY', 'MISAPPLYING_AN_AXIOM', 'MISAPPLYING_A_COROLLARY', 'MISAPPLYING_A_CONJECTURE', 'MISAPPLYING_A_PROPOSITION', 'AFFIRMING_THE_CONSEQUENT', 'CIRCULAR_REASONING', 'JUMPING_TO_CONCLUSIONS', 'IMPROPER_GENERALIZATION');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MODERATE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ValidationLayer" AS ENUM ('LATEX_PARSER', 'PROOF_GRAMMER', 'COMPUTATION', 'LOGIC_CHAIN');

-- CreateEnum
CREATE TYPE "Library" AS ENUM ('DEFINITION', 'THEOREM', 'LEMMA', 'PROPERTY', 'AXIOM', 'COROLLARY', 'CONJECTURE', 'PROPOSITION');

-- CreateEnum
CREATE TYPE "Textbook" AS ENUM ('Fuchs_102');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('CANADA');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ULTIMATE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE');

-- CreateTable
CREATE TABLE "User" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "privateUniversityId" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "privateId" SERIAL NOT NULL,
    "privateUserId" INTEGER NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "Sessions" (
    "privateId" SERIAL NOT NULL,
    "privateUserId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessions_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "Document" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "privateOwnerId" INTEGER NOT NULL,
    "proofType" "ProofType" NOT NULL,
    "privateCourseId" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "lastCompiled" TIMESTAMP(3),
    "lastEdited" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "DocumentBody" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "privateDocumentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentBody_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "ProofAttempt" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "privateDocumentId" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "versionName" TEXT,
    "manualSave" BOOLEAN NOT NULL DEFAULT false,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "historicalMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofAttempt_pkey" PRIMARY KEY ("privateId")
);

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

-- CreateTable
CREATE TABLE "Error" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,
    "suggestedFix" JSONB,
    "privateDocumentId" INTEGER NOT NULL,
    "type" "ErrorType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "layer" "ValidationLayer" NOT NULL,
    "model" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Error_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "DocumentMathStatements" (
    "privateDocumentId" INTEGER NOT NULL,
    "privateMathStatementId" INTEGER NOT NULL,
    "privateHintId" INTEGER NOT NULL,
    "wasUsed" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentMathStatements_pkey" PRIMARY KEY ("privateDocumentId","privateMathStatementId","privateHintId")
);

-- CreateTable
CREATE TABLE "MathStatement" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "Library" NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "privateCourseId" INTEGER NOT NULL,
    "textbook" "Textbook" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MathStatement_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "userCourse" (
    "privateUserId" INTEGER NOT NULL,
    "privateCourseId" INTEGER NOT NULL,
    "unenrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "userCourse_pkey" PRIMARY KEY ("privateUserId","privateCourseId")
);

-- CreateTable
CREATE TABLE "Course" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "universityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "University" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "country" "Country" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "University_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" "PlanTier" NOT NULL,
    "monthlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dailyDocLimit" INTEGER NOT NULL,
    "hintsPerDefLimit" INTEGER NOT NULL,
    "suggestionLimit" INTEGER NOT NULL,
    "errorVisibility" "ValidationLayer" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "privateUserId" INTEGER NOT NULL,
    "docsCreatedToday" INTEGER NOT NULL DEFAULT 0,
    "suggestionsUsedToday" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "privateUserId" INTEGER NOT NULL,
    "planId" INTEGER,
    "status" "SubscriptionStatus" NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "processorSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("privateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_accessToken_key" ON "OAuthAccount"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_refreshToken_key" ON "OAuthAccount"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_providerName_providerId_key" ON "OAuthAccount"("providerName", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sessions_accessToken_key" ON "Sessions"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Sessions_refreshToken_key" ON "Sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "Document_publicId_key" ON "Document"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_privateOwnerId_title_key" ON "Document"("privateOwnerId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBody_publicId_key" ON "DocumentBody"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ProofAttempt_publicId_key" ON "ProofAttempt"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_publicId_key" ON "Hint"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Error_publicId_key" ON "Error"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MathStatement_publicId_key" ON "MathStatement"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_publicId_key" ON "Course"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_universityId_name_key" ON "Course"("universityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "University_publicId_key" ON "University"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_publicId_key" ON "DailyUsage"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_privateUserId_date_key" ON "DailyUsage"("privateUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_publicId_key" ON "Subscription"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_privateUserId_key" ON "Subscription"("privateUserId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_privateUniversityId_fkey" FOREIGN KEY ("privateUniversityId") REFERENCES "University"("privateId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessions" ADD CONSTRAINT "Sessions_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_privateOwnerId_fkey" FOREIGN KEY ("privateOwnerId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_privateCourseId_fkey" FOREIGN KEY ("privateCourseId") REFERENCES "Course"("privateId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentBody" ADD CONSTRAINT "DocumentBody_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofAttempt" ADD CONSTRAINT "ProofAttempt_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hint" ADD CONSTRAINT "Hint_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Error" ADD CONSTRAINT "Error_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMathStatements" ADD CONSTRAINT "DocumentMathStatements_privateDocumentId_fkey" FOREIGN KEY ("privateDocumentId") REFERENCES "Document"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMathStatements" ADD CONSTRAINT "DocumentMathStatements_privateMathStatementId_fkey" FOREIGN KEY ("privateMathStatementId") REFERENCES "MathStatement"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMathStatements" ADD CONSTRAINT "DocumentMathStatements_privateHintId_fkey" FOREIGN KEY ("privateHintId") REFERENCES "Hint"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MathStatement" ADD CONSTRAINT "MathStatement_privateCourseId_fkey" FOREIGN KEY ("privateCourseId") REFERENCES "Course"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userCourse" ADD CONSTRAINT "userCourse_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userCourse" ADD CONSTRAINT "userCourse_privateCourseId_fkey" FOREIGN KEY ("privateCourseId") REFERENCES "Course"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_privateUserId_fkey" FOREIGN KEY ("privateUserId") REFERENCES "User"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
