-- AlterTable
ALTER TABLE "DailyUsage" ALTER COLUMN "date" SET DEFAULT (now() AT TIME ZONE 'utc')::date;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "username" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UniversityDomain" (
    "privateId" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "privateUniversityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniversityDomain_pkey" PRIMARY KEY ("privateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UniversityDomain_publicId_key" ON "UniversityDomain"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityDomain_domain_key" ON "UniversityDomain"("domain");

-- AddForeignKey
ALTER TABLE "UniversityDomain" ADD CONSTRAINT "UniversityDomain_privateUniversityId_fkey" FOREIGN KEY ("privateUniversityId") REFERENCES "University"("privateId") ON DELETE CASCADE ON UPDATE CASCADE;
