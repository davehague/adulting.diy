-- CreateTable
CREATE TABLE "project_documents" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "blobPath" STRING NOT NULL,
    "fileName" STRING NOT NULL,
    "name" STRING NOT NULL,
    "note" STRING,
    "contentType" STRING NOT NULL,
    "sizeBytes" INT4 NOT NULL,
    "uploadedById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_documents" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "project_documents_blobPath_key" ON "project_documents"("blobPath");

-- CreateIndex
CREATE INDEX "project_documents_projectId_createdAt_idx" ON "project_documents"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
