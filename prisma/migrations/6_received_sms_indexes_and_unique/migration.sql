-- AddUniqueConstraint to ReceivedSmsLog
ALTER TABLE "ReceivedSmsLog" ADD CONSTRAINT "ReceivedSmsLog_userId_sender_receivedAt_key" UNIQUE ("userId", "sender", "receivedAt");

-- CreateIndex
CREATE INDEX "ReceivedSmsLog_receivedAt_idx" ON "ReceivedSmsLog"("receivedAt");

-- CreateIndex
CREATE INDEX "ReceivedSmsLog_userId_idx" ON "ReceivedSmsLog"("userId");

-- CreateIndex
CREATE INDEX "ReceivedSmsLog_sender_idx" ON "ReceivedSmsLog"("sender");
