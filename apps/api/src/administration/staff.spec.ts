import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { StaffController } from "./staff.controller";
import { StaffListDto } from "./staff.dto";
import { StaffService } from "./staff.service";

test("staff directory denies sessions without staff management permission", () => {
  const controller = new StaffController({
    list: () => {
      throw new Error("must not query");
    },
  } as never);
  assert.throws(
    () =>
      controller.list(
        { auth: { permissions: [] } } as never,
        new StaffListDto(),
      ),
    ForbiddenException,
  );
});

test("staff directory applies search, role, and account status with bounded pagination", async () => {
  let args: { where: unknown; skip: number; take: number } | undefined;
  const prisma = {
    staffProfile: {
      count: async () => 1,
      findMany: async (query: {
        where: unknown;
        skip: number;
        take: number;
      }) => {
        args = query;
        return [];
      },
    },
  };
  const result = await new StaffService(
    prisma as never,
    {} as never,
    {} as never,
  ).list({
    page: 2,
    pageSize: 10,
    search: "Lee",
    status: "ACTIVE",
    role: "QUOTE_OFFICER",
    department: "Operations",
  });
  assert.equal(args?.skip, 10);
  assert.equal(args?.take, 10);
  assert.match(JSON.stringify(args?.where), /QUOTE_OFFICER/);
  assert.match(JSON.stringify(args?.where), /ACTIVE/);
  assert.match(JSON.stringify(args?.where), /Lee/);
  assert.match(JSON.stringify(args?.where), /Operations/);
  assert.equal(result.total, 1);
});

test("staff creation denies administrators who are not super administrators", () => {
  const controller = new StaffController({
    create: () => {
      throw new Error("must not create");
    },
  } as never);
  assert.throws(
    () =>
      controller.create(
        {
          auth: {
            user: { id: "admin", roles: ["ADMINISTRATOR"] },
            permissions: ["staff:manage"],
          },
        } as never,
        {
          email: "staff@example.invalid",
          password: "temporary-password",
          fullName: "Staff Member",
          employeeCode: "EMP-1",
          role: "SHIPMENT_OFFICER",
        },
      ),
    ForbiddenException,
  );
});

test("staff creation hashes the temporary password and audits without including it", async () => {
  let created: Record<string, unknown> | undefined;
  let auditEntry: Record<string, unknown> | undefined;
  const tx = {
    user: {
      findFirst: async () => ({ id: "super-1" }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = data;
        return { id: "staff-1", email: data.email };
      },
    },
    role: { findUnique: async () => ({ id: "role-1" }) },
  };
  const prisma = {
    $transaction: async (operation: (value: typeof tx) => Promise<unknown>) =>
      operation(tx),
  };
  const audit = {
    recordInTransaction: async (
      _tx: unknown,
      entry: Record<string, unknown>,
    ) => {
      auditEntry = entry;
    },
  };
  const auth = { sendStaffInvitation: async () => undefined };
  const service = new StaffService(
    prisma as never,
    audit as never,
    auth as never,
  );
  const response = await service.create("super-1", {
    email: "STAFF@example.invalid",
    password: "temporary-password",
    fullName: " Staff Member ",
    employeeCode: " EMP-1 ",
    role: "SHIPMENT_OFFICER",
  });
  assert.equal(created?.email, "staff@example.invalid");
  assert.equal(created?.mustChangePassword, true);
  assert.equal(created?.status, "INVITED");
  assert.equal(created?.emailVerifiedAt, undefined);
  assert.equal(response.invitationSent, true);
  assert.notEqual(created?.passwordHash, "temporary-password");
  assert.doesNotMatch(JSON.stringify(auditEntry), /temporary-password/);
});

test("suspending staff revokes sessions and records the change transactionally", async () => {
  const calls: string[] = [];
  const tx = {
    user: {
      findFirst: async () => ({ id: "super-1" }),
      updateMany: async ({ data }: { data: { status: string } }) => {
        assert.equal(data.status, "SUSPENDED");
        calls.push("status");
        return { count: 1 };
      },
    },
    staffProfile: {
      findUnique: async () => ({
        user: {
          id: "staff-1",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          userRoles: [{ role: { name: "SHIPMENT_OFFICER" } }],
        },
      }),
    },
    session: {
      updateMany: async () => {
        calls.push("sessions");
        return { count: 1 };
      },
    },
    verificationChallenge: { updateMany: async () => { calls.push("challenges"); return { count: 0 }; } },
  };
  const prisma = {
    $transaction: async (operation: (value: typeof tx) => Promise<unknown>) =>
      operation(tx),
  };
  const audit = {
    recordInTransaction: async () => {
      calls.push("audit");
    },
  };
  const result = await new StaffService(
    prisma as never,
    audit as never,
    {} as never,
  ).changeStatus("super-1", "profile-1", "SUSPEND");
  assert.equal(result.status, "SUSPENDED");
  assert.deepEqual(calls, ["status", "sessions", "challenges", "audit"]);
});

test("staff lifecycle controls cannot modify a super administrator", async () => {
  const tx = {
    user: { findFirst: async () => ({ id: "super-1" }) },
    staffProfile: {
      findUnique: async () => ({
        user: {
          id: "super-2",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          userRoles: [{ role: { name: "SUPER_ADMINISTRATOR" } }],
        },
      }),
    },
  };
  const prisma = {
    $transaction: async (operation: (value: typeof tx) => Promise<unknown>) =>
      operation(tx),
  };
  const service = new StaffService(prisma as never, {} as never, {} as never);
  await assert.rejects(
    service.changeStatus("super-1", "profile-2", "SUSPEND"),
    ForbiddenException,
  );
});
