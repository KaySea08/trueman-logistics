-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('ORDER_RECEIVED', 'ORDER_CONFIRMED', 'AWAITING_PICKUP', 'PICKED_UP', 'ORIGIN_FACILITY', 'EXPORT_PROCESSING', 'DEPARTED_ORIGIN', 'IN_TRANSIT', 'ARRIVED_DESTINATION', 'CUSTOMS_PROCESSING', 'CUSTOMS_CLEARED', 'DESTINATION_FACILITY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'HELD_FOR_INSPECTION', 'RETURNED_TO_SENDER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentMode" AS ENUM ('EXPRESS', 'AIR', 'SEA', 'ROAD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM ('SHIPMENT_ORDER', 'PASSWORD_RESET', 'LOGIN', 'CONTACT_VERIFICATION', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('CUSTOMER', 'INTERNAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'ORDER_RECEIVED',
    "mode" "ShipmentMode" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "quotedAmount" DECIMAL(12,2),
    "declaredValue" DECIMAL(12,2),
    "estimatedDelivery" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentPackage" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(9,3) NOT NULL,
    "lengthCm" DECIMAL(9,2),
    "widthCm" DECIMAL(9,2),
    "heightCm" DECIMAL(9,2),

    CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentAddress" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "postalCode" TEXT,

    CONSTRAINT "ShipmentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingReference" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TrackingReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationChallenge" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "destination" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "previousStatus" "ShipmentStatus",
    "status" "ShipmentStatus" NOT NULL,
    "locationLabel" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentDocument" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT,
    "channel" TEXT NOT NULL,
    "destinationDigest" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "recoveryCodeDigests" TEXT[],
    "enabledAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "previousHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sourceDigest" TEXT,
    "accountId" TEXT,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportInquiry" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "serviceName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_isPrimary_idx" ON "CustomerContact"("customerId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "Shipment_customerId_createdAt_idx" ON "Shipment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_status_updatedAt_idx" ON "Shipment"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ShipmentAddress_shipmentId_kind_idx" ON "ShipmentAddress"("shipmentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingReference_shipmentId_key" ON "TrackingReference"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingReference_tokenDigest_key" ON "TrackingReference"("tokenDigest");

-- CreateIndex
CREATE INDEX "VerificationChallenge_subjectId_purpose_expiresAt_idx" ON "VerificationChallenge"("subjectId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_occurredAt_idx" ON "ShipmentEvent"("shipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_staffId_assignedAt_idx" ON "DeliveryAssignment"("staffId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_shipmentId_status_idx" ON "Payment"("shipmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentDocument_objectKey_key" ON "ShipmentDocument"("objectKey");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenDigest_key" ON "Session"("tokenDigest");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaConfiguration_userId_key" ON "MfaConfiguration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_idx" ON "AuditEvent"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_category_occurredAt_idx" ON "SecurityEvent"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_occurredAt_idx" ON "SecurityEvent"("severity", "occurredAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_status_createdAt_idx" ON "SupportInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_email_createdAt_idx" ON "SupportInquiry"("email", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAddress" ADD CONSTRAINT "ShipmentAddress_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingReference" ADD CONSTRAINT "TrackingReference_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaConfiguration" ADD CONSTRAINT "MfaConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
