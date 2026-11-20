import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { SecurityController } from "./security.controller";
import { SecurityAdministrationService } from "./security.service";

test("session administration denies callers without session management permission", () => {
  const controller = new SecurityController({ listSessions: () => { throw new Error("must not query"); } } as never);
  assert.throws(() => controller.sessions({ auth: { user: { id: "staff" }, permissions: ["staff:manage"] } } as never, { page: 1, pageSize: 25 }), ForbiddenException);
});

test("session administration protects super-administrator accounts from single-session revocation", async () => {
  const tx = { session: { findUnique: async () => ({ id: "session", userId: "target", revokedAt: null, user: { staff: { id: "staff" }, userRoles: [{ role: { name: "SUPER_ADMINISTRATOR" } }] } }) } };
  const prisma = { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) };
  await assert.rejects(() => new SecurityAdministrationService(prisma as never, {} as never).revokeSession("actor", "session"), ForbiddenException);
});

test("session administration protects the acting administrator from self-revocation", async () => {
  const tx = { session: { findUnique: async () => ({ id: "session", userId: "actor", revokedAt: null, user: { staff: { id: "staff" }, userRoles: [{ role: { name: "SUPER_ADMINISTRATOR" } }] } }) } };
  const prisma = { $transaction: (operation: (client: typeof tx) => unknown) => operation(tx) };
  await assert.rejects(() => new SecurityAdministrationService(prisma as never, {} as never).revokeSession("actor", "session"), ForbiddenException);
});
