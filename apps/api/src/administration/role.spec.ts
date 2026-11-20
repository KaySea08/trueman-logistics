import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";

test("role management denies callers without the dedicated permission", () => {
  const controller = new RoleController({ list: () => { throw new Error("must not query"); } } as never);
  assert.throws(() => controller.list({ auth: { user: { id: "staff", roles: ["ADMINISTRATOR"] }, permissions: ["staff:manage"] } } as never), ForbiddenException);
});

test("role management denies non-super-administrators even if a permission is accidentally granted", () => {
  const controller = new RoleController({ list: () => { throw new Error("must not query"); } } as never);
  assert.throws(() => controller.list({ auth: { user: { id: "staff", roles: ["ADMINISTRATOR"] }, permissions: ["roles:manage"] } } as never), ForbiddenException);
});

test("role service rejects reserved system roles before persistence", async () => {
  const prisma = { $transaction: () => { throw new Error("must not persist"); } };
  await assert.rejects(
    () => new RoleService(prisma as never, {} as never).create("actor", { name: "SUPER_ADMINISTRATOR", permissions: [] }),
    ForbiddenException,
  );
});

test("role service prevents custom roles from receiving administrative control permissions", async () => {
  let created = false;
  const tx = {
    user: { findFirst: async () => ({ id: "actor" }) },
    permission: { findMany: async ({ where }: { where: { key: { in: string[] } } }) => where.key.in.map((key) => ({ id: key, key })) },
    role: { create: async () => { created = true; return { id: "role", name: "CUSTOM" }; } },
  };
  const prisma = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
  await assert.rejects(
    () => new RoleService(prisma as never, {} as never).create("actor", { name: "CUSTOM", permissions: ["staff:manage"] }),
    ForbiddenException,
  );
  assert.equal(created, false);
});
