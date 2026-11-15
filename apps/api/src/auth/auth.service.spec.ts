import assert from "node:assert/strict";
import test from "node:test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { authenticator } from "otplib";
import * as argon2 from "argon2";

import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";

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

test("a valid MFA login challenge cannot create two concurrent sessions", async () => {
  const previousKey = process.env.MFA_ENCRYPTION_KEY;
  const encryptionKey = randomBytes(32);
  process.env.MFA_ENCRYPTION_KEY = encryptionKey.toString("hex");
  const secret = authenticator.generateSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const encryptedSecret = [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
  let challengeExists = true;
  let sessions = 0;
  const sessionTransaction = {
    $queryRaw: async () => [{ status: "ACTIVE", passwordHash: "test-hash" }],
    session: {
      create: async () => {
        sessions += 1;
      },
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1",
        status: "ACTIVE",
        passwordHash: "test-hash",
        mfaEnabled: true,
        mfaConfiguration: { encryptedSecret, recoveryCodeDigests: [] },
        userRoles: [],
        customer: null,
      }),
    },
    $transaction: async (
      operation: (value: typeof sessionTransaction) => Promise<void>,
    ) => operation(sessionTransaction),
  };
  const redis = {
    incr: async () => 1,
    expire: async () => undefined,
    get: async () =>
      challengeExists
        ? JSON.stringify({
            userId: "staff-1",
            passwordFingerprint: createHash("sha256")
              .update("test-hash")
              .digest("hex"),
          })
        : null,
    del: async () => {
      if (!challengeExists) return 0;
      challengeExists = false;
      return 1;
    },
  };
  const service = new AuthService(
    prisma as never,
    redis as never,
    {} as never,
    {} as never,
    { recordInTransaction: async () => undefined } as never,
  );

  try {
    const code = authenticator.generate(secret);
    const results = await Promise.allSettled([
      service.completeMfaLogin("same-challenge", code),
      service.completeMfaLogin("same-challenge", code),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(sessions, 1);
  } finally {
    if (previousKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousKey;
  }
});

test("changing a password verifies the current secret and revokes sessions transactionally", async () => {
  const oldHash = await argon2.hash("old-password-for-test");
  const calls: string[] = [];
  let replacement = "";
  const tx = {
    user: {
      updateMany: async ({ data }: { data: { passwordHash: string } }) => {
        calls.push("password");
        replacement = data.passwordHash;
        return { count: 1 };
      },
    },
    session: {
      updateMany: async () => {
        calls.push("sessions");
        return { count: 1 };
      },
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({ status: "ACTIVE", passwordHash: oldHash }),
    },
    $transaction: async (operation: (value: typeof tx) => Promise<void>) =>
      operation(tx),
  };
  const redis = { incr: async () => 1, expire: async () => undefined };
  const audit = {
    recordInTransaction: async () => {
      calls.push("audit");
    },
  };
  const service = new AuthService(
    prisma as never,
    redis as never,
    {} as never,
    {} as never,
    audit as never,
  );
  await assert.rejects(
    service.changePassword(
      "staff-1",
      "wrong-password",
      "new-password-for-test",
    ),
    /Current password is incorrect/,
  );
  assert.deepEqual(calls, []);
  await service.changePassword(
    "staff-1",
    "old-password-for-test",
    "new-password-for-test",
  );
  assert.deepEqual(calls, ["password", "sessions", "audit"]);
  assert.equal(await argon2.verify(replacement, "new-password-for-test"), true);
});

test("staff with a temporary password can change it but cannot access protected operations", async () => {
  const guard = new SessionGuard({
    getSession: async () => ({
      user: {
        roles: ["SHIPMENT_OFFICER"],
        mfaEnabled: true,
        mustChangePassword: true,
      },
      permissions: [],
      sessionId: "session-1",
    }),
  } as never);
  const context = (path: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          cookies: { trueman_session: "session-token" },
        }),
      }),
    }) as never;
  await assert.rejects(
    guard.canActivate(context("/api/v1/admin/operations/summary")),
    /temporary password/,
  );
  assert.equal(
    await guard.canActivate(context("/api/v1/auth/password/change")),
    true,
  );
  assert.equal(await guard.canActivate(context("/api/v1/auth/me")), true);
});

test("staff must enroll MFA before changing a temporary password", async () => {
  const guard = new SessionGuard({
    getSession: async () => ({
      user: {
        roles: ["SHIPMENT_OFFICER"],
        mfaEnabled: false,
        mustChangePassword: true,
      },
    }),
  } as never);
  const context = (path: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          cookies: { trueman_session: "session-token" },
        }),
      }),
    }) as never;
  await assert.rejects(
    guard.canActivate(context("/api/v1/auth/password/change")),
    /Multi-factor/,
  );
  assert.equal(
    await guard.canActivate(context("/api/v1/auth/mfa/setup")),
    true,
  );
});

test("an MFA challenge issued before a password change is rejected", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1",
        status: "ACTIVE",
        mfaEnabled: true,
        passwordHash: "new-hash",
        mfaConfiguration: {
          encryptedSecret: "unused",
          recoveryCodeDigests: [],
        },
      }),
    },
  };
  const redis = {
    incr: async () => 1,
    expire: async () => undefined,
    get: async () =>
      JSON.stringify({
        userId: "staff-1",
        passwordFingerprint: createHash("sha256")
          .update("old-hash")
          .digest("hex"),
      }),
  };
  const service = new AuthService(
    prisma as never,
    redis as never,
    {} as never,
    {} as never,
    {} as never,
  );
  await assert.rejects(
    service.completeMfaLogin("old-challenge", "123456"),
    /MFA is not configured/,
  );
});

test("session creation rejects credentials changed after MFA verification", async () => {
  const previousKey = process.env.MFA_ENCRYPTION_KEY;
  const key = randomBytes(32);
  process.env.MFA_ENCRYPTION_KEY = key.toString("hex");
  const secret = authenticator.generateSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const encryptedSecret = [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
  let created = false;
  const tx = {
    $queryRaw: async () => [{ status: "ACTIVE", passwordHash: "new-hash" }],
    session: {
      create: async () => {
        created = true;
      },
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1",
        status: "ACTIVE",
        mfaEnabled: true,
        passwordHash: "old-hash",
        mfaConfiguration: { encryptedSecret, recoveryCodeDigests: [] },
        userRoles: [],
        customer: null,
      }),
    },
    $transaction: async (operation: (value: typeof tx) => Promise<void>) =>
      operation(tx),
  };
  const redis = {
    incr: async () => 1,
    expire: async () => undefined,
    del: async () => 1,
    get: async () =>
      JSON.stringify({
        userId: "staff-1",
        passwordFingerprint: createHash("sha256")
          .update("old-hash")
          .digest("hex"),
      }),
  };
  try {
    const service = new AuthService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await assert.rejects(
      service.completeMfaLogin("challenge", authenticator.generate(secret)),
      /Credentials changed/,
    );
    assert.equal(created, false);
  } finally {
    if (previousKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previousKey;
  }
});

test("email verification cannot reactivate a suspended account", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1",
        status: "SUSPENDED",
        emailVerifiedAt: null,
      }),
    },
  };
  const redis = { incr: async () => 1, expire: async () => undefined };
  const service = new AuthService(
    prisma as never,
    redis as never,
    {} as never,
    {} as never,
    {} as never,
  );
  await assert.rejects(
    service.verifyEmail("staff@example.invalid", "123456"),
    /Invalid or expired verification code/,
  );
});
