-- CreateTable
CREATE TABLE "project_chat_messages" (
    "id" STRING NOT NULL,
    "projectId" STRING NOT NULL,
    "role" STRING NOT NULL,
    "content" STRING NOT NULL,
    "createdById" STRING NOT NULL,
    "searches" JSONB NOT NULL DEFAULT '[]',
    "failedAt" TIMESTAMP(3),
    "thinkingMs" INT4,
    "durationMs" INT4,
    "model" STRING,
    "promptTokens" INT4,
    "outputTokens" INT4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the index and foreign keys below can be added.
ALTER TABLE "project_chat_messages" SET (schema_locked = false);

-- CreateIndex
CREATE INDEX "project_chat_messages_projectId_createdAt_idx" ON "project_chat_messages"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_chat_messages" ADD CONSTRAINT "project_chat_messages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_chat_messages" ADD CONSTRAINT "project_chat_messages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
