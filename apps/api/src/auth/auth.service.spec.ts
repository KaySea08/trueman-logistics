import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AuthService } from "./auth.service";

test("register converts Prisma duplicate email constraint errors into a ConflictException", async () => {
  const prisma = {
    user: {
      findUnique: async () => null,
      create: async () => {
        throw new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`email`)",
          {
            code: "P2002",
            clientVersion: "test-version",
            meta: { target: ["email"] },
          },
        );
      },
    },
  } as any;

  const service = new AuthService(
    prisma,
    {
      incr: async () => 1,
      expire: async () => undefined,
    } as any,
    {} as any,
    {} as any,
    { record: async () => undefined } as any,
  );

  await assert.rejects(
    () =>
      service.register({
        email: "new@example.com",
        password: "Password123",
        fullName: "Test User",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.match((error as Error).message, /email/i);
      return true;
    },
  );
});
