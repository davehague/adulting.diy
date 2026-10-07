-- CreateTable
CREATE TABLE "project_plans" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "extraText" STRING,
    "result" JSONB NOT NULL,
    "model" STRING NOT NULL,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_plans_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the index and foreign keys below can be added.
ALTER TABLE "project_plans" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "project_plans_projectId_key" ON "project_plans"("projectId");

-- AddForeignKey
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
