-- "projects" was unlocked by its own migration (20261003120000_add_projects); repeating it is harmless and makes this file safe on its own.
ALTER TABLE "projects" SET (schema_locked = false);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "providerCategoryId" STRING;

-- CreateTable
CREATE TABLE "project_providers" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "status" STRING NOT NULL DEFAULT 'considering',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_providers_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_providers" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "project_providers_providerId_idx" ON "project_providers"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_providers_projectId_providerId_key" ON "project_providers"("projectId", "providerId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_providerCategoryId_fkey" FOREIGN KEY ("providerCategoryId") REFERENCES "provider_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_providers" ADD CONSTRAINT "project_providers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
