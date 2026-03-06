-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvFile" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CsvFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "business_name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city_state" TEXT,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "website_domain" TEXT,
    "claimed" TEXT,
    "detail_path" TEXT,
    "search_niche" TEXT,
    "search_location" TEXT,
    "scraped_at" TEXT,
    "email" TEXT,
    "website_full" TEXT,
    "facebook" TEXT,
    "twitter" TEXT,
    "linkedin" TEXT,
    "instagram" TEXT,
    "enrichment_status" TEXT,
    "enriched_at" TEXT,
    "extraFields" JSONB,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Lead_fileId_idx" ON "Lead"("fileId");

-- CreateIndex
CREATE INDEX "Lead_business_name_idx" ON "Lead"("business_name");

-- CreateIndex
CREATE INDEX "Lead_city_state_idx" ON "Lead"("city_state");

-- CreateIndex
CREATE INDEX "Lead_search_niche_idx" ON "Lead"("search_niche");

-- CreateIndex
CREATE INDEX "Lead_search_location_idx" ON "Lead"("search_location");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- AddForeignKey
ALTER TABLE "CsvFile" ADD CONSTRAINT "CsvFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "CsvFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
