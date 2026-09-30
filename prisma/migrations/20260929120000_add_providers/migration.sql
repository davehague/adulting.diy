-- CreateTable
CREATE TABLE "provider_categories" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "sortOrder" INT4 NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_categories_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "provider_categories" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "provider_statuses" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "kind" STRING NOT NULL DEFAULT 'neutral',
    "hiddenByDefault" BOOL NOT NULL DEFAULT false,
    "sortOrder" INT4 NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_statuses_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "provider_statuses" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "providers" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "categoryId" STRING NOT NULL,
    "statusId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "nameKey" STRING NOT NULL,
    "company" STRING,
    "primaryContactName" STRING,
    "phone" STRING,
    "email" STRING,
    "website" STRING,
    "address" STRING,
    "licenseNumber" STRING,
    "googlePlaceId" STRING,
    "rating" INT4,
    "hiredAt" TIMESTAMP(3),
    "notes" STRING,
    "metaStatus" STRING NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "providers" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "provider_contacts" (
    "id" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "role" STRING,
    "phone" STRING,
    "email" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_contacts_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "provider_contacts" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "provider_evidence" (
    "id" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "sourceUrl" STRING NOT NULL,
    "sourceGroup" STRING,
    "sourceDate" TIMESTAMP(3),
    "snippet" STRING,
    "kind" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_evidence_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "provider_evidence" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "provider_comments" (
    "id" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "authorId" STRING NOT NULL,
    "body" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_comments_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "provider_comments" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "task_providers" (
    "id" STRING NOT NULL,
    "taskId" STRING NOT NULL,
    "providerId" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_providers_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "task_providers" SET (schema_locked = false);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "prefix" STRING NOT NULL,
    "hashedKey" STRING NOT NULL,
    "createdByUserId" STRING NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CockroachDB locks new tables against schema changes by default; unlock so the indexes and foreign keys below can be added.
ALTER TABLE "api_keys" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "provider_categories_householdId_name_key" ON "provider_categories"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_statuses_householdId_name_key" ON "provider_statuses"("householdId", "name");

-- CreateIndex
CREATE INDEX "providers_householdId_metaStatus_idx" ON "providers"("householdId", "metaStatus");

-- CreateIndex
CREATE INDEX "providers_householdId_categoryId_nameKey_idx" ON "providers"("householdId", "categoryId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "providers_householdId_googlePlaceId_key" ON "providers"("householdId", "googlePlaceId");

-- CreateIndex
CREATE INDEX "provider_contacts_providerId_idx" ON "provider_contacts"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_evidence_providerId_sourceUrl_key" ON "provider_evidence"("providerId", "sourceUrl");

-- CreateIndex
CREATE INDEX "provider_comments_providerId_createdAt_idx" ON "provider_comments"("providerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_providers_taskId_providerId_key" ON "task_providers"("taskId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");

-- CreateIndex
CREATE INDEX "api_keys_householdId_idx" ON "api_keys"("householdId");

-- AddForeignKey
ALTER TABLE "provider_categories" ADD CONSTRAINT "provider_categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_statuses" ADD CONSTRAINT "provider_statuses_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "provider_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "provider_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_contacts" ADD CONSTRAINT "provider_contacts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_evidence" ADD CONSTRAINT "provider_evidence_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_comments" ADD CONSTRAINT "provider_comments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_comments" ADD CONSTRAINT "provider_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_providers" ADD CONSTRAINT "task_providers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_providers" ADD CONSTRAINT "task_providers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

