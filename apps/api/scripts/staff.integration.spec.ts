import assert from "node:assert/strict";
import test from "node:test";
import { createDecipheriv, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser = require("cookie-parser");
import { AppModule } from "../dist/app.module";
import { PrismaService } from "../dist/prisma/prisma.service";
import { REDIS } from "../dist/redis/redis.module";

const database = process.env.DATABASE_URL ?? "";
const isolated = (() => {
  try {
    const url = new URL(database);
    return (
      url.hostname === "trueman-phase6-test-db" &&
      url.pathname === "/phase6_test"
    );
  } catch {
    return false;
  }
})();

test(
  "staff invitation, MFA enrollment and password change work end to end",
  { skip: !isolated, timeout: 60000 },
  async () => {
    process.env.AUTH_PEPPER = randomBytes(32).toString("hex");
    process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    process.env.REDIS_URL = "redis://redis:6379/15";
    process.env.SMTP_HOST = "mailpit";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.QUOTE_WORKER_ENABLED = "false";
    process.env.WEB_ORIGIN = "http://localhost:5173";
    const app = await NestFactory.create(AppModule, { logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix("api/v1");
    await app.listen(0, "127.0.0.1");
    const prisma = app.get(PrismaService);
    const redis = app.get<{ disconnect: () => void }>(REDIS);
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string")
      throw new Error("Test server did not start.");
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    const testId = randomBytes(8).toString("hex");
    const adminEmail = `phase6-admin-${testId}@example.invalid`;
    const staffEmail = `phase6-staff-${testId}@example.invalid`;
    const adminPassword = randomBytes(24).toString("base64url");
    const temporaryPassword = randomBytes(24).toString("base64url");
    const nextPassword = randomBytes(24).toString("base64url");
    const mailIds: string[] = [];

    async function request(
      path: string,
      method: string,
      body?: unknown,
      cookie?: string,
    ) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          origin: "http://localhost:5173",
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      return {
        status: response.status,
        payload,
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }

    async function enrollMfa(email: string, cookie: string) {
      const setup = await request("/auth/mfa/setup", "POST", {}, cookie);
      assert.equal(setup.status, 201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { mfaConfiguration: true },
      });
      assert.ok(user.mfaConfiguration);
      const [iv, tag, encrypted] = user.mfaConfiguration.encryptedSecret
        .split(".")
        .map((part: string) => Buffer.from(part, "base64"));
      const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(process.env.MFA_ENCRYPTION_KEY!, "hex"),
        iv,
      );
      decipher.setAuthTag(tag);
      const secret = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8");
      const enabled = await request(
        "/auth/mfa/enable",
        "POST",
        { code: authenticator.generate(secret) },
        cookie,
      );
      assert.equal(enabled.status, 201);
      return secret;
    }

    try {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: await argon2.hash(adminPassword, {
            type: argon2.argon2id,
          }),
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
          staff: {
            create: {
              employeeCode: `ADMIN-${testId}`,
              fullName: "Test Administrator",
            },
          },
          userRoles: {
            create: { role: { connect: { name: "SUPER_ADMINISTRATOR" } } },
          },
        },
      });
      const adminLogin = await request("/auth/login", "POST", {
        email: adminEmail,
        password: adminPassword,
      });
      assert.equal(adminLogin.status, 201);
      assert.equal(adminLogin.payload.mfaSetupRequired, true);
      assert.ok(adminLogin.cookie);
      await enrollMfa(adminEmail, adminLogin.cookie);

      const created = await request(
        "/admin/staff",
        "POST",
        {
          email: staffEmail,
          password: temporaryPassword,
          fullName: "Test Staff",
          employeeCode: `STAFF-${testId}`,
          role: "QUOTE_OFFICER",
        },
        adminLogin.cookie,
      );
      assert.equal(created.status, 201);
      assert.equal(created.payload.invitationSent, true);
      assert.equal(
        (created.payload.user as { status: string }).status,
        "INVITED",
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: staffEmail,
            password: temporaryPassword,
          })
        ).status,
        401,
      );

      const search = await fetch(
        `http://mailpit:8025/api/v1/search?query=${encodeURIComponent(`to:${staffEmail}`)}`,
      );
      const found = (await search.json()) as {
        messages?: Array<{ ID: string }>;
      };
      assert.ok(found.messages?.length);
      mailIds.push(...found.messages.map((message) => message.ID));
      const mail = (await (
        await fetch(
          `http://mailpit:8025/api/v1/message/${found.messages[0].ID}`,
        )
      ).json()) as { Text?: string };
      assert.ok(mail.Text && !mail.Text.includes(temporaryPassword));
      const code = mail.Text.match(/\b\d{6}\b/)?.[0];
      assert.ok(code);
      assert.equal(
        (
          await request("/auth/verify-email", "POST", {
            email: staffEmail,
            code,
          })
        ).status,
        201,
      );

      const staffLogin = await request("/auth/login", "POST", {
        email: staffEmail,
        password: temporaryPassword,
      });
      assert.equal(staffLogin.status, 201);
      assert.equal(staffLogin.payload.mfaSetupRequired, true);
      assert.ok(staffLogin.cookie);
      const staffSecret = await enrollMfa(staffEmail, staffLogin.cookie);
      assert.equal(
        (
          await request(
            "/admin/quote-requests",
            "GET",
            undefined,
            staffLogin.cookie,
          )
        ).status,
        403,
      );
      const profile = await request(
        "/auth/me",
        "GET",
        undefined,
        staffLogin.cookie,
      );
      assert.equal(profile.payload.mustChangePassword, true);
      assert.equal(
        (
          await request(
            "/auth/password/change",
            "POST",
            { currentPassword: temporaryPassword, newPassword: nextPassword },
            staffLogin.cookie,
          )
        ).status,
        201,
      );
      assert.equal(
        (await request("/auth/me", "GET", undefined, staffLogin.cookie)).status,
        401,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: staffEmail,
            password: temporaryPassword,
          })
        ).status,
        401,
      );
      const login = await request("/auth/login", "POST", {
        email: staffEmail,
        password: nextPassword,
      });
      assert.equal(login.payload.mfaRequired, true);
      const completed = await request("/auth/mfa/login", "POST", {
        challenge: login.payload.challenge,
        code: authenticator.generate(staffSecret),
      });
      assert.equal(completed.status, 201);
      assert.ok(completed.cookie);
      assert.equal(
        (await request("/auth/me", "GET", undefined, completed.cookie)).payload
          .mustChangePassword,
        false,
      );
      assert.equal(
        (
          await request(
            "/admin/quote-requests",
            "GET",
            undefined,
            completed.cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/admin/staff", "GET", undefined, completed.cookie))
          .status,
        403,
      );
      const staff = await prisma.staffProfile.findFirstOrThrow({
        where: { user: { email: staffEmail } },
        select: { id: true },
      });
      const suspended = await request(
        `/admin/staff/${staff.id}/status`,
        "PATCH",
        { action: "SUSPEND" },
        adminLogin.cookie,
      );
      assert.equal(suspended.status, 200);
      assert.equal(suspended.payload.status, "SUSPENDED");
      assert.equal(
        (await request("/auth/me", "GET", undefined, completed.cookie)).status,
        401,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: staffEmail,
            password: nextPassword,
          })
        ).status,
        401,
      );
      const reactivated = await request(
        `/admin/staff/${staff.id}/status`,
        "PATCH",
        { action: "REACTIVATE" },
        adminLogin.cookie,
      );
      assert.equal(reactivated.status, 200);
      assert.equal(reactivated.payload.status, "ACTIVE");
      assert.equal(
        (await request("/auth/me", "GET", undefined, completed.cookie)).status,
        401,
      );
      const adminProfile = await prisma.staffProfile.findFirstOrThrow({
        where: { user: { email: adminEmail } },
        select: { id: true },
      });
      assert.equal(
        (
          await request(
            `/admin/staff/${adminProfile.id}/status`,
            "PATCH",
            { action: "SUSPEND" },
            adminLogin.cookie,
          )
        ).status,
        403,
      );
    } finally {
      if (mailIds.length)
        await fetch("http://mailpit:8025/api/v1/messages", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: mailIds }),
        });
      await app.close();
      redis.disconnect();
    }
  },
);
