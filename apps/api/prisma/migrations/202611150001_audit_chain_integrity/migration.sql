CREATE UNIQUE INDEX "AuditEvent_previousHash_unique"
  ON "AuditEvent" ("previousHash")
  WHERE "previousHash" IS NOT NULL;

CREATE UNIQUE INDEX "AuditEvent_single_root"
  ON "AuditEvent" ((1))
  WHERE "previousHash" IS NULL;