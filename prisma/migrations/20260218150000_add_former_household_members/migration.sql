-- CreateTable
CREATE TABLE "former_household_members" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "householdId" STRING NOT NULL,
    "name" STRING NOT NULL,
    "leftAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "former_household_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "former_household_members_userId_householdId_key" ON "former_household_members"("userId", "householdId");
