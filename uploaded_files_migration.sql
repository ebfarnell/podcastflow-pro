-- Add UploadedFile table for file management system
-- This migration adds comprehensive file upload and management capabilities

CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on s3Key
CREATE UNIQUE INDEX "UploadedFile_s3Key_key" ON "UploadedFile"("s3Key");

-- Create indexes for performance
CREATE INDEX "UploadedFile_organizationId_idx" ON "UploadedFile"("organizationId");
CREATE INDEX "UploadedFile_uploadedById_idx" ON "UploadedFile"("uploadedById");
CREATE INDEX "UploadedFile_category_idx" ON "UploadedFile"("category");
CREATE INDEX "UploadedFile_entityType_entityId_idx" ON "UploadedFile"("entityType", "entityId");
CREATE INDEX "UploadedFile_status_idx" ON "UploadedFile"("status");
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt");

-- Add foreign key constraints
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;