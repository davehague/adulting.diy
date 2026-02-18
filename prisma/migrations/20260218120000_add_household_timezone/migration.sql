-- AlterTable: Add timezone column to households
ALTER TABLE "households" ADD COLUMN "timezone" STRING NOT NULL DEFAULT 'UTC';
