-- Phase 5: shipment operations, review workflow and submitter attribution.
-- Existing shipment rows are backfilled as customer-originated records because
-- Phase 4 did not persist the original submitter identity.
CREATE TYPE "ShipmentReviewStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'NEEDS_CORRECTION'
);

CREATE TYPE "ShipmentCreationSource" AS ENUM (
  'CUSTOMER',
  'STAFF',
  'SYSTEM'
);

ALTER TABLE "Shipment"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "submitterRole" TEXT,
  ADD COLUMN "creationSource" "ShipmentCreationSource" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewStatus" "ShipmentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;

-- Preserve the closest historical submission timestamp for existing rows.
UPDATE "Shipment" SET "submittedAt" = "createdAt";

CREATE INDEX "Shipment_reviewStatus_submittedAt_idx"
  ON "Shipment"("reviewStatus", "submittedAt");
CREATE INDEX "Shipment_creationSource_submittedAt_idx"
  ON "Shipment"("creationSource", "submittedAt");
CREATE INDEX "Shipment_createdByUserId_submittedAt_idx"
  ON "Shipment"("createdByUserId", "submittedAt");

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Operational shipment history is append-only. Corrections are new events,
-- not edits to prior events.
CREATE FUNCTION "reject_shipment_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Shipment events are immutable; append a corrective event instead.';
END;
$$;

CREATE TRIGGER "ShipmentEvent_immutable"
BEFORE UPDATE OR DELETE ON "ShipmentEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_shipment_event_mutation"();

-- Preserve actor references and prevent in-place mutation of audit records.
-- User accounts must be suspended/deactivated rather than hard-deleted.
ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_actorUserId_fkey";
ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable.';
END;
$$;

CREATE TRIGGER "AuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();
