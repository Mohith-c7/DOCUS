-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'IMAGE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingStage" AS ENUM ('UPLOADING', 'UPLOADED', 'EXTRACTING', 'OCR_PROCESSING', 'NORMALIZING', 'SUMMARIZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('NATIVE', 'OCR');

-- CreateEnum
CREATE TYPE "SummaryLength" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "currentStage" "ProcessingStage" NOT NULL DEFAULT 'UPLOADED',
    "extractionMethod" "ExtractionMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "length" "SummaryLength" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "mainIdeas" TEXT[],
    "processingVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_currentStage_idx" ON "Document"("currentStage");

-- CreateIndex
CREATE INDEX "Summary_documentId_idx" ON "Summary"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_documentId_length_key" ON "Summary"("documentId", "length");

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
