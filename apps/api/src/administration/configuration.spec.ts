import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { ConfigurationService } from "./configuration.service";

test("configuration reads safe defaults without exposing secrets", async () => {
  const service = new ConfigurationService({ systemConfiguration: { findUnique: async () => null } } as never, {} as never);
  assert.deepEqual(await service.read(), { sessionDays: 7, sessionPolicyVersion: 0, privilegedMfaRequired: true, minimumPasswordLength: 12, updatedAt: null });
});

test("configuration updates require an active MFA-enabled super administrator", async () => {
  let wrote = false;
  const tx = { user: { findFirst: async () => null }, systemConfiguration: { upsert: async () => { wrote = true; } } };
  const prisma = { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) };
  await assert.rejects(() => new ConfigurationService(prisma as never, {} as never).update("actor", { sessionDays: 14 }), ForbiddenException);
  assert.equal(wrote, false);
});
