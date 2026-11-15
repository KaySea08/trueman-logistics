CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "headId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffProfile"
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "supervisorId" TEXT;

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE INDEX "Department_active_name_idx" ON "Department"("active", "name");
CREATE INDEX "StaffProfile_departmentId_active_fullName_idx" ON "StaffProfile"("departmentId", "active", "fullName");
CREATE INDEX "StaffProfile_supervisorId_idx" ON "StaffProfile"("supervisorId");

ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey"
  FOREIGN KEY ("headId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;