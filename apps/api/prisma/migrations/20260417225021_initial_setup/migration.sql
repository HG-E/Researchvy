-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESEARCHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('JOURNAL_ARTICLE', 'CONFERENCE_PAPER', 'BOOK_CHAPTER', 'BOOK', 'PREPRINT', 'THESIS', 'DATASET', 'REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('ORCID', 'OPEN_ALEX', 'SEMANTIC_SCHOLAR', 'CROSSREF', 'MANUAL');

-- CreateEnum
CREATE TYPE "PolicyDocumentType" AS ENUM ('UN_REPORT', 'GOVERNMENT', 'PARLIAMENT', 'NGO_REPORT', 'REGULATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('OPEN_ACCESS', 'POLICY_SUBMISSION', 'PREPRINT_UPLOAD', 'ORCID_COMPLETE', 'PROFILE_COMPLETE', 'COLLABORATION', 'CONFERENCE');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESEARCHER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Researcher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orcidId" TEXT,
    "orcidAccessToken" TEXT,
    "orcidTokenExpiry" TIMESTAMP(3),
    "openAlexId" TEXT,
    "semanticScholarId" TEXT,
    "displayName" TEXT NOT NULL,
    "institution" TEXT,
    "department" TEXT,
    "country" TEXT,
    "fields" TEXT[],
    "bio" TEXT,
    "websiteUrl" TEXT,
    "twitterHandle" TEXT,
    "hIndex" INTEGER NOT NULL DEFAULT 0,
    "totalCitations" INTEGER NOT NULL DEFAULT 0,
    "publicationCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Researcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "doi" TEXT,
    "openAlexId" TEXT,
    "pmid" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "year" INTEGER,
    "type" "PublicationType" NOT NULL DEFAULT 'JOURNAL_ARTICLE',
    "journalName" TEXT,
    "venueName" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "openAccess" BOOLEAN NOT NULL DEFAULT false,
    "openAccessUrl" TEXT,
    "coAuthors" JSONB,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyMention" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "policyTitle" TEXT NOT NULL,
    "policyUrl" TEXT,
    "policyType" "PolicyDocumentType" NOT NULL DEFAULT 'OTHER',
    "country" TEXT,
    "year" INTEGER,
    "organization" TEXT,
    "source" TEXT NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilityScore" (
    "id" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "citationScore" DOUBLE PRECISION NOT NULL,
    "velocityScore" DOUBLE PRECISION NOT NULL,
    "policyScore" DOUBLE PRECISION NOT NULL,
    "openAccessScore" DOUBLE PRECISION NOT NULL,
    "collaborationScore" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT '1.0',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisibilityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "impact" "ImpactLevel" NOT NULL,
    "isActioned" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "resourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_userId_key" ON "Researcher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_orcidId_key" ON "Researcher"("orcidId");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_openAlexId_key" ON "Researcher"("openAlexId");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_semanticScholarId_key" ON "Researcher"("semanticScholarId");

-- CreateIndex
CREATE INDEX "Researcher_orcidId_idx" ON "Researcher"("orcidId");

-- CreateIndex
CREATE INDEX "Researcher_openAlexId_idx" ON "Researcher"("openAlexId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_doi_key" ON "Publication"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_openAlexId_key" ON "Publication"("openAlexId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_pmid_key" ON "Publication"("pmid");

-- CreateIndex
CREATE INDEX "Publication_researcherId_year_idx" ON "Publication"("researcherId", "year");

-- CreateIndex
CREATE INDEX "Publication_citationCount_idx" ON "Publication"("citationCount");

-- CreateIndex
CREATE INDEX "PolicyMention_publicationId_idx" ON "PolicyMention"("publicationId");

-- CreateIndex
CREATE INDEX "VisibilityScore_researcherId_computedAt_idx" ON "VisibilityScore"("researcherId", "computedAt");

-- CreateIndex
CREATE INDEX "Recommendation_researcherId_isActioned_idx" ON "Recommendation"("researcherId", "isActioned");

-- CreateIndex
CREATE INDEX "SyncJob_researcherId_createdAt_idx" ON "SyncJob"("researcherId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Researcher" ADD CONSTRAINT "Researcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyMention" ADD CONSTRAINT "PolicyMention_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilityScore" ADD CONSTRAINT "VisibilityScore_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
