CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "RateBasis" AS ENUM ('CHARGEABLE_KG', 'ACTUAL_KG', 'CBM');

CREATE TABLE "RateRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mode" "ShipmentMode" NOT NULL,
  "basis" "RateBasis" NOT NULL,
  "originCountryCode" TEXT NOT NULL DEFAULT 'CN',
  "destinationCountryCode" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "ratePerUnit" DECIMAL(12,4) NOT NULL,
  "minimumCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "handlingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "volumetricDivisor" DECIMAL(12,2) NOT NULL DEFAULT 6000,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateRule_mode_destinationCountryCode_active_validFrom_idx" ON "RateRule"("mode", "destinationCountryCode", "active", "validFrom");

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "quoteNumber" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "rateRuleId" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'QUOTED',
  "mode" "ShipmentMode" NOT NULL,
  "originCountryCode" TEXT NOT NULL DEFAULT 'CN',
  "destinationCountryCode" TEXT NOT NULL,
  "destinationCity" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "handlingFee" DECIMAL(12,2) NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "chargeableWeightKg" DECIMAL(12,3),
  "volumeCbm" DECIMAL(12,4),
  "validUntil" TIMESTAMP(3) NOT NULL,
  "requestSnapshot" JSONB NOT NULL,
  "pricingSnapshot" JSONB NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE INDEX "Quote_customerId_createdAt_idx" ON "Quote"("customerId", "createdAt");
CREATE INDEX "Quote_status_validUntil_idx" ON "Quote"("status", "validUntil");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rateRuleId_fkey" FOREIGN KEY ("rateRuleId") REFERENCES "RateRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment" ADD COLUMN "quoteId" TEXT;
CREATE UNIQUE INDEX "Shipment_quoteId_key" ON "Shipment"("quoteId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
