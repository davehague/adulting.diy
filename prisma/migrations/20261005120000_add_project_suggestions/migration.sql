-- CreateTable
CREATE TABLE "project_suggestions" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "extraText" STRING,
    "result" JSONB NOT NULL,
    "model" STRING NOT NULL,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_suggestions_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "project_suggestions" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "feature" STRING NOT NULL,
    "model" STRING NOT NULL,
    "outcome" STRING NOT NULL,
    "durationMs" INT4,
    "promptTokens" INT4,
    "outputTokens" INT4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_request_logs" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "project_suggestions_projectId_key" ON "project_suggestions"("projectId");

-- CreateIndex
CREATE INDEX "ai_request_logs_householdId_feature_createdAt_idx" ON "ai_request_logs"("householdId", "feature", "createdAt");

-- AddForeignKey
ALTER TABLE "project_suggestions" ADD CONSTRAINT "project_suggestions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_suggestions" ADD CONSTRAINT "project_suggestions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
