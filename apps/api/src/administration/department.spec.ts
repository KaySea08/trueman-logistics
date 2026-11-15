import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { DepartmentController } from "./department.controller";
import { DepartmentService } from "./department.service";

test("department creation requires system management permission", () => {
  const controller = new DepartmentController({
    create: () => {
      throw new Error("must not create");
    },
  } as never);
  assert.throws(
    () =>
      controller.create(
        {
          auth: { user: { id: "user" }, permissions: ["staff:manage"] },
        } as never,
        { name: "Operations" },
      ),
    ForbiddenException,
  );
});

test("department creation and audit occur in one transaction", async () => {
  const calls: string[] = [];
  const tx = {
    department: {
      create: async () => {
        calls.push("create");
        return { id: "department-1", name: "Operations", active: true };
      },
    },
  };
  const prisma = {
    $transaction: async (operation: (value: typeof tx) => Promise<unknown>) => {
      calls.push("transaction");
      return operation(tx);
    },
  };
  const audit = {
    recordInTransaction: async (
      transaction: unknown,
      entry: { actorUserId: string },
    ) => {
      assert.equal(transaction, tx);
      assert.equal(entry.actorUserId, "manager-1");
      calls.push("audit");
    },
  };
  await new DepartmentService(prisma as never, audit as never).create(
    "manager-1",
    { name: " Operations " },
  );
  assert.deepEqual(calls, ["transaction", "create", "audit"]);
});
