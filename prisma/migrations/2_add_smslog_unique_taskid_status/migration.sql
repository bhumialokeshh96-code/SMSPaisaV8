-- Remove duplicate SmsLog entries (keep the first one for each taskId+status combo)
DELETE FROM "SmsLog" a USING "SmsLog" b
WHERE a."id" > b."id"
  AND a."taskId" = b."taskId"
  AND a."status" = b."status";

-- Add unique constraint
CREATE UNIQUE INDEX "SmsLog_taskId_status_key" ON "SmsLog"("taskId", "status");
