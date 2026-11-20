ALTER TABLE "User"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "Session"
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "sourceDigest" VARCHAR(64),
  ADD COLUMN "userAgent" VARCHAR(512);

ALTER TABLE "Role"
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Role"
SET "isSystem" = true
WHERE "name" IN (
  'SUPER_ADMINISTRATOR',
  'ADMINISTRATOR',
  'OPERATIONS_MANAGER',
  'QUOTE_OFFICER',
  'SHIPMENT_OFFICER',
  'WAREHOUSE_PERSONNEL',
  'DELIVERY_PERSONNEL',
  'FINANCE_OFFICER',
  'CUSTOMER_SUPPORT',
  'CUSTOMER'
);

ALTER TABLE "DeliveryAssignment"
  ADD COLUMN "assignedByUserId" TEXT,
  ADD COLUMN "reason" VARCHAR(500);

CREATE INDEX "DeliveryAssignment_staffId_unassignedAt_assignedAt_idx"
  ON "DeliveryAssignment"("staffId", "unassignedAt", "assignedAt");
CREATE INDEX "DeliveryAssignment_shipmentId_assignedAt_idx"
  ON "DeliveryAssignment"("shipmentId", "assignedAt");

CREATE TABLE "SystemConfiguration" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SystemConfigurationVersion" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemConfigurationVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemConfigurationVersion_key_version_key"
  ON "SystemConfigurationVersion"("key", "version");
CREATE INDEX "SystemConfigurationVersion_key_createdAt_idx"
  ON "SystemConfigurationVersion"("key", "createdAt");
CREATE INDEX "SystemConfiguration_updatedByUserId_updatedAt_idx"
  ON "SystemConfiguration"("updatedByUserId", "updatedAt");

ALTER TABLE "DeliveryAssignment"
  ADD CONSTRAINT "DeliveryAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemConfiguration"
  ADD CONSTRAINT "SystemConfiguration_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemConfigurationVersion"
  ADD CONSTRAINT "SystemConfigurationVersion_key_fkey"
  FOREIGN KEY ("key") REFERENCES "SystemConfiguration"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SystemConfigurationVersion_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
