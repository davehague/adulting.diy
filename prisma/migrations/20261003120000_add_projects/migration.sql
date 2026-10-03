-- CreateTable
CREATE TABLE "projects" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "title" STRING NOT NULL,
    "location" STRING,
    "status" STRING NOT NULL DEFAULT 'planning',
    "path" STRING,
    "notes" STRING,
    "completedAt" TIMESTAMP(3),
    "metaStatus" STRING NOT NULL DEFAULT 'active',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "projects" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "project_photos" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "fullPath" STRING NOT NULL,
    "thumbPath" STRING NOT NULL,
    "width" INT4 NOT NULL,
    "height" INT4 NOT NULL,
    "position" INT4 NOT NULL,
    "uploadedById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_photos_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_photos" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "projects_householdId_metaStatus_status_idx" ON "projects"("householdId", "metaStatus", "status");

-- CreateIndex
CREATE INDEX "project_photos_projectId_position_idx" ON "project_photos"("projectId", "position");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
