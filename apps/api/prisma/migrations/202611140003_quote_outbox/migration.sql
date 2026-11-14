CREATE TYPE "QuoteOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER');
CREATE TYPE "QuoteOutboxType" AS ENUM ('REQUEST_RECEIVED', 'QUOTE_READY');

CREATE TABLE "QuoteOutboxEvent" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "type" "QuoteOutboxType" NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "QuoteOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteOutboxEvent_eventKey_key" ON "QuoteOutboxEvent"("eventKey");
CREATE INDEX "QuoteOutboxEvent_status_availableAt_createdAt_idx" ON "QuoteOutboxEvent"("status", "availableAt", "createdAt");
CREATE INDEX "QuoteOutboxEvent_aggregateId_createdAt_idx" ON "QuoteOutboxEvent"("aggregateId", "createdAt");