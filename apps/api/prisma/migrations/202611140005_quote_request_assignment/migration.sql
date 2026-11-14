ALTER TABLE "QuoteRequest" ADD COLUMN "assignedToStaffId" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "assignedAt" TIMESTAMP(3);
CREATE INDEX "QuoteRequest_assignedToStaffId_status_createdAt_idx" ON "QuoteRequest"("assignedToStaffId", "status", "createdAt");
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_assignedToStaffId_fkey" FOREIGN KEY ("assignedToStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;