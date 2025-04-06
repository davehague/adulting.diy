-- DropEnum (Removed problematic DROP TYPE "crdb_internal_region";)


-- CreateTable
CREATE TABLE "users" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING NOT NULL,
    "picture" STRING,
    "householdId" STRING,
    "isAdmin" BOOL NOT NULL DEFAULT false,
    "notificationPreferences" JSONB NOT NULL DEFAULT '{"task_created":"any","task_paused":"any","task_completed":"any","task_deleted":"any","occurrence_assigned":"mine","occurrence_executed":"mine","occurrence_skipped":"mine","occurrence_commented":"mine"}',
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "inviteCode" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "householdId" STRING,
    "isDefault" BOOL NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_definitions" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "description" STRING,
    "instructions" STRING,
    "categoryId" STRING NOT NULL,
    "metaStatus" STRING NOT NULL,
    "scheduleConfig" JSONB NOT NULL,
    "reminderConfig" JSONB,
    "createdByUserId" STRING NOT NULL,
    "defaultAssigneeIds" STRING[] DEFAULT ARRAY[]::STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_occurrences" (
    "id" STRING NOT NULL,
    "taskId" STRING NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" STRING NOT NULL,
    "assigneeIds" STRING[] DEFAULT ARRAY[]::STRING[],
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_history_logs" (
    "id" STRING NOT NULL,
    "occurrenceId" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "logType" STRING NOT NULL,
    "oldValue" STRING,
    "newValue" STRING,
    "comment" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occurrence_history_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "households_inviteCode_key" ON "households"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_householdId_key" ON "categories"("name", "householdId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_definitions" ADD CONSTRAINT "task_definitions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_history_logs" ADD CONSTRAINT "occurrence_history_logs_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "task_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_history_logs" ADD CONSTRAINT "occurrence_history_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
