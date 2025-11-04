-- AlterTable
ALTER TABLE "users" ADD COLUMN "password" STRING;
ALTER TABLE "users" ADD COLUMN "authProvider" STRING NOT NULL DEFAULT 'google';
