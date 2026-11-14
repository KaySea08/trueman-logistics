CREATE TABLE "QuoteRequestHistory" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRequestHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteRequestHistory_requestId_createdAt_idx" ON "QuoteRequestHistory"("requestId", "createdAt");
CREATE INDEX "QuoteRequestHistory_actorUserId_createdAt_idx" ON "QuoteRequestHistory"("actorUserId", "createdAt");
ALTER TABLE "QuoteRequestHistory" ADD CONSTRAINT "QuoteRequestHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteRequestHistory" ADD CONSTRAINT "QuoteRequestHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;