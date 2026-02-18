-- CreateTable
CREATE TABLE "task_history_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "taskId" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "logType" STRING NOT NULL,
    "details" JSONB,
    "comment" STRING,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "task_history_logs" ADD CONSTRAINT "task_history_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history_logs" ADD CONSTRAINT "task_history_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
