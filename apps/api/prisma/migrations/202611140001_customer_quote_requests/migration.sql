CREATE TYPE "QuoteRequestStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SENT');

CREATE TABLE "QuoteRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(64),
  "mode" "ShipmentMode" NOT NULL,
  "destinationCountryCode" TEXT NOT NULL,
  "destinationCity" TEXT NOT NULL,
  "status" "QuoteRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRequest_requestNumber_key" ON "QuoteRequest"("requestNumber");
CREATE UNIQUE INDEX "QuoteRequest_customerId_idempotencyKey_key" ON "QuoteRequest"("customerId", "idempotencyKey");
CREATE INDEX "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt");
CREATE INDEX "QuoteRequest_customerId_createdAt_idx" ON "QuoteRequest"("customerId", "createdAt");

ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote" ADD COLUMN "quoteRequestId" TEXT;
CREATE UNIQUE INDEX "Quote_quoteRequestId_key" ON "Quote"("quoteRequestId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;