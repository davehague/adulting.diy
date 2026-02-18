-- Update the column default to include channels
ALTER TABLE "users" ALTER COLUMN "notificationPreferences" SET DEFAULT '{"task_created":"any","task_paused":"any","task_deleted":"any","occurrence_assigned":"mine","occurrence_executed":"mine","occurrence_skipped":"mine","occurrence_commented":"mine","reminder_initial":"any","reminder_followup":"any","reminder_overdue":"any","channels":{"email":true,"slack":false},"channelConfig":{}}';

-- Backfill existing users: add email channel enabled for users who don't have channels set
UPDATE "users"
SET "notificationPreferences" = "notificationPreferences"::jsonb || '{"channels": {"email": true, "slack": false}}'::jsonb
WHERE "notificationPreferences"::jsonb->'channels' IS NULL;
