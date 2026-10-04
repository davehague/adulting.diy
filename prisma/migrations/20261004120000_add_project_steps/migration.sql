-- CreateTable
CREATE TABLE "project_steps" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "text" STRING NOT NULL,
    "position" INT4 NOT NULL,
    "doneAt" TIMESTAMP(3),
    "estimateMinutes" INT4,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the index and foreign keys below can be added.
ALTER TABLE "project_steps" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "project_steps_projectId_position_idx" ON "project_steps"("projectId", "position");

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
