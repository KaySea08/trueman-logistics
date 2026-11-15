import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  createHmac,
  randomBytes,
  randomInt,
  createCipheriv,
  createDecipheriv,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { Prisma } from "@prisma/client";
import QRCode = require("qrcode");
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS } from "../redis/redis.module";
import { Inject } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { SmsService } from "../mail/sms.service";
import { AuditService } from "../common/audit.service";

const SESSION_DAYS = 7;
const OTP_MINUTES = 5;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  private pepper() {
    const p = process.env.AUTH_PEPPER;
    if (!p || p.length < 32)
      throw new Error(
        "AUTH_PEPPER must be configured with at least 32 characters",
      );
    return p;
  }
  private codeDigest(code: string, challengeId: string) {
    return createHmac("sha256", this.pepper())
      .update(`${challengeId}:${code}`)
      .digest();
  }
  private digestMatches(code: string, challengeId: string, expected: Buffer) {
    const actual = this.codeDigest(code, challengeId);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
  private handleUniqueConstraint(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target[0]
        : error.meta?.target;
      const field =
        typeof target === "string" ? target.toLowerCase() : "account";

      if (field === "email")
        throw new ConflictException(
          "An account with this email already exists.",
        );
      if (field === "phone")
        throw new ConflictException(
          "This phone number is already associated with an account.",
        );
      throw new ConflictException(
        "An account with this email or phone number already exists.",
      );
    }

    throw error;
  }
  private async throttle(key: string, limit = 8, seconds = 300) {
    const count = await this.redis.incr(`rl:${key}`);
    if (count === 1) await this.redis.expire(`rl:${key}`, seconds);
    if (count > limit)
      throw new HttpException(
        "Too many attempts. Please wait before trying again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  private async issueCode(
    userId: string,
    email: string,
    purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
  ) {
    const code = String(randomInt(100000, 1000000));
    const challengeId = randomBytes(16).toString("hex");
    await this.prisma.verificationChallenge.updateMany({
      where: { subjectId: userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.verificationChallenge.create({
      data: {
        id: challengeId,
        subjectId: userId,
        purpose,
        codeDigest: this.codeDigest(code, challengeId).toString("hex"),
        destination: email,
        expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000),
        maxAttempts: 5,
      },
    });
    await this.mail.sendVerificationCode(
      email,
      code,
      purpose === "EMAIL_VERIFICATION" ? "verify" : "reset",
    );
  }

  async register(
    input: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    },
    ip = "unknown",
  ) {
    const email = input.email.trim().toLowerCase();
    await this.throttle(`register:email:${email}`, 4, 3600);
    await this.throttle(`register:ip:${digest(ip)}`, 10, 3600);
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException("An account with this email already exists.");
    if (
      input.phone &&
      (await this.prisma.user.findUnique({ where: { phone: input.phone } }))
    )
      throw new ConflictException(
        "This phone number is already associated with an account.",
      );
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    let user: { id: string; email: string | null };
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          phone: input.phone,
          passwordHash,
          status: "INVITED",
          customer: { create: { displayName: input.fullName.trim() } },
          userRoles: { create: { role: { connect: { name: "CUSTOMER" } } } },
        },
        select: { id: true, email: true },
      });
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
    try {
      await this.issueCode(user.id, email, "EMAIL_VERIFICATION");
    } catch (error) {
      await this.audit.record({
        actorUserId: user.id,
        action: "CUSTOMER_REGISTERED_EMAIL_DELIVERY_FAILED",
        targetType: "User",
        targetId: user.id,
        outcome: "FAILURE",
      });
      throw error;
    }
    await this.audit.record({
      actorUserId: user.id,
      action: "CUSTOMER_REGISTERED",
      targetType: "User",
      targetId: user.id,
      outcome: "SUCCESS",
    });
    return {
      message:
        "Account created. Check your email for the six-digit verification code.",
    };
  }

  async verifyEmail(emailInput: string, code: string) {
    const email = emailInput.trim().toLowerCase();
    await this.throttle(`verify-email:${email}`, 8, 300);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "INVITED" || user.emailVerifiedAt)
      throw new BadRequestException("Invalid or expired verification code.");
    const challenge = await this.prisma.verificationChallenge.findFirst({
      where: {
        subjectId: user.id,
        purpose: "EMAIL_VERIFICATION",
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge)
      throw new BadRequestException("Invalid or expired verification code.");
    const valid = this.digestMatches(
      code,
      challenge.id,
      Buffer.from(challenge.codeDigest, "hex"),
    );
    if (!valid) {
      await this.prisma.verificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: { lt: 5 },
          expiresAt: { gt: new Date() },
        },
        data: { attempts: { increment: 1 } },
      });
      await this.audit.record({
        actorUserId: user.id,
        action: "EMAIL_VERIFICATION_FAILED",
        targetType: "User",
        targetId: user.id,
        outcome: "FAILURE",
      });
      throw new BadRequestException("Invalid or expired verification code.");
    }
    const verifiedUser = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const consumed = await tx.verificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: { lt: 5 },
          expiresAt: { gt: now },
        },
        data: { attempts: { increment: 1 }, consumedAt: now },
      });
      if (consumed.count !== 1)
        throw new BadRequestException("Invalid or expired verification code.");
      const activated = await tx.user.updateMany({
        where: { id: user.id, status: "INVITED", emailVerifiedAt: null },
        data: { emailVerifiedAt: now, status: "ACTIVE" },
      });
      if (activated.count !== 1)
        throw new BadRequestException("Invalid or expired verification code.");
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { customer: true },
      });
    });
    if (verifiedUser.customer && verifiedUser.email)
      await this.prisma.customerContact.upsert({
        where: { id: `email-${verifiedUser.customer.id}` },
        create: {
          id: `email-${verifiedUser.customer.id}`,
          customerId: verifiedUser.customer.id,
          type: "EMAIL",
          value: verifiedUser.email,
          verifiedAt: new Date(),
          isPrimary: true,
        },
        update: {
          value: verifiedUser.email,
          verifiedAt: new Date(),
          isPrimary: true,
        },
      });
    await this.audit.record({
      actorUserId: user.id,
      action: "EMAIL_VERIFIED",
      targetType: "User",
      targetId: user.id,
      outcome: "SUCCESS",
    });
    return { message: "Email verified. You can now sign in." };
  }

  async resendVerification(emailInput: string, ip = "unknown") {
    const email = emailInput.trim().toLowerCase();
    await this.throttle(`resend:email:${email}`, 3, 900);
    await this.throttle(`resend:ip:${digest(ip)}`, 10, 900);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === "INVITED" && !user.emailVerifiedAt)
      await this.issueCode(user.id, email, "EMAIL_VERIFICATION");
    return {
      message: "If the account needs verification, a new code has been sent.",
    };
  }

  async sendStaffInvitation(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        staff: { select: { id: true } },
      },
    });
    if (
      !user?.staff ||
      !user.email ||
      user.status !== "INVITED" ||
      user.emailVerifiedAt
    )
      throw new BadRequestException(
        "Staff account is not awaiting verification.",
      );
    await this.issueCode(user.id, user.email, "EMAIL_VERIFICATION");
  }

  async requestPhoneVerification(userId: string) {
    await this.throttle(`phone-verify:${userId}`, 3, 900);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone)
      throw new BadRequestException(
        "Add a phone number to your account before verifying it.",
      );
    if (user.phoneVerifiedAt)
      return { message: "This phone number is already verified." };
    const code = String(randomInt(100000, 1000000));
    const challengeId = randomBytes(16).toString("hex");
    await this.prisma.verificationChallenge.updateMany({
      where: {
        subjectId: userId,
        purpose: "CONTACT_VERIFICATION",
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    await this.prisma.verificationChallenge.create({
      data: {
        id: challengeId,
        subjectId: userId,
        purpose: "CONTACT_VERIFICATION",
        codeDigest: this.codeDigest(code, challengeId).toString("hex"),
        destination: user.phone,
        expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000),
        maxAttempts: 5,
      },
    });
    await this.sms.sendVerificationCode(user.phone, code);
    return { message: "A phone verification code has been sent." };
  }
  async verifyPhone(userId: string, code: string) {
    await this.throttle(`phone-code:${userId}`, 8, 300);
    const challenge = await this.prisma.verificationChallenge.findFirst({
      where: {
        subjectId: userId,
        purpose: "CONTACT_VERIFICATION",
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (
      !challenge ||
      !this.digestMatches(
        code,
        challenge.id,
        Buffer.from(challenge.codeDigest, "hex"),
      )
    ) {
      if (challenge)
        await this.prisma.verificationChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
      throw new BadRequestException("Invalid or expired verification code.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      const user = await tx.user.update({
        where: { id: userId },
        data: { phoneVerifiedAt: new Date() },
        include: { customer: true },
      });
      if (user.customer && user.phone)
        await tx.customerContact.upsert({
          where: { id: `phone-${user.customer.id}` },
          create: {
            id: `phone-${user.customer.id}`,
            customerId: user.customer.id,
            type: "PHONE",
            value: user.phone,
            verifiedAt: new Date(),
            isPrimary: true,
          },
          update: {
            value: user.phone,
            verifiedAt: new Date(),
            isPrimary: true,
          },
        });
    });
    await this.audit.record({
      actorUserId: userId,
      action: "PHONE_VERIFIED",
      targetType: "User",
      targetId: userId,
      outcome: "SUCCESS",
    });
    return { message: "Phone number verified successfully." };
  }

  async login(emailInput: string, password: string, ip: string) {
    const email = emailInput.trim().toLowerCase();
    await this.throttle(`login:${digest(ip)}:${email}`, 8, 900);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        customer: true,
        mfaConfiguration: true,
      },
    });
    const valid =
      !!user?.passwordHash &&
      (await argon2.verify(user.passwordHash, password).catch(() => false));
    if (!user || !valid || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      await this.audit.record({
        actorUserId: user?.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user?.id,
        outcome: "FAILURE",
        metadata: { emailDigest: digest(email) },
      });
      throw new UnauthorizedException(
        "Invalid credentials or account not activated.",
      );
    }
    if (user.mfaEnabled)
      return {
        mfaRequired: true,
        challenge: await this.issueMfaChallenge(user.id, user.passwordHash!),
      };
    const privileged = user.userRoles.some(
      (assignment) => assignment.role.name !== "CUSTOMER",
    );
    return {
      user: this.publicUser(user),
      sessionToken: await this.createSession(user.id, user.passwordHash!),
      ...(privileged ? { mfaSetupRequired: true } : {}),
    };
  }
  private async issueMfaChallenge(userId: string, passwordHash: string) {
    const token = randomBytes(32).toString("base64url");
    await this.redis.set(
      `mfa-login:${digest(token)}`,
      JSON.stringify({ userId, passwordFingerprint: digest(passwordHash) }),
      "EX",
      300,
    );
    return token;
  }
  async completeMfaLogin(challenge: string, code: string) {
    await this.throttle(`mfa-login:${digest(challenge)}`, 5, 300);
    const key = `mfa-login:${digest(challenge)}`;
    const stored = await this.redis.get(key);
    if (!stored) throw new UnauthorizedException("MFA challenge expired.");
    let payload: { userId?: unknown; passwordFingerprint?: unknown };
    try {
      payload = JSON.parse(stored) as typeof payload;
      if (
        typeof payload.userId !== "string" ||
        typeof payload.passwordFingerprint !== "string"
      )
        throw new Error("Invalid challenge");
    } catch {
      throw new UnauthorizedException("MFA challenge expired.");
    }
    const userId = payload.userId as string;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        mfaConfiguration: true,
        userRoles: { include: { role: true } },
        customer: true,
      },
    });
    if (
      !user?.mfaConfiguration ||
      user.status !== "ACTIVE" ||
      !user.mfaEnabled ||
      !user.passwordHash ||
      digest(user.passwordHash) !== payload.passwordFingerprint
    )
      throw new UnauthorizedException("MFA is not configured.");
    const secret = this.decryptSecret(user.mfaConfiguration.encryptedSecret);
    const validTotp = authenticator.check(code, secret);
    const recoveryIndex = user.mfaConfiguration.recoveryCodeDigests.indexOf(
      digest(code.toUpperCase()),
    );
    if (!validTotp && recoveryIndex < 0)
      throw new UnauthorizedException("Invalid MFA code.");
    if ((await this.redis.del(key)) !== 1)
      throw new UnauthorizedException("MFA challenge expired.");
    if (!validTotp && recoveryIndex >= 0) {
      const codes = [...user.mfaConfiguration.recoveryCodeDigests];
      codes.splice(recoveryIndex, 1);
      const consumed = await this.prisma.mfaConfiguration.updateMany({
        where: {
          userId,
          recoveryCodeDigests: {
            equals: user.mfaConfiguration.recoveryCodeDigests,
          },
        },
        data: { recoveryCodeDigests: codes },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException("Invalid MFA code.");
    }
    return {
      user: this.publicUser(user),
      sessionToken: await this.createSession(user.id, user.passwordHash),
    };
  }
  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      customer: user.customer
        ? { displayName: user.customer.displayName }
        : null,
      roles: user.userRoles?.map((x: any) => x.role.name) ?? [],
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
    };
  }
  private async createSession(userId: string, expectedPasswordHash: string) {
    const raw = randomBytes(32).toString("base64url");
    await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        Array<{ status: string; passwordHash: string | null }>
      >`
        SELECT "status", "passwordHash" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      if (
        users[0]?.status !== "ACTIVE" ||
        users[0]?.passwordHash !== expectedPasswordHash
      )
        throw new UnauthorizedException("Credentials changed. Sign in again.");
      await tx.session.create({
        data: {
          userId,
          tokenDigest: digest(raw),
          expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
        },
      });
      await this.audit.recordInTransaction(tx, {
        actorUserId: userId,
        action: "SESSION_CREATED",
        targetType: "Session",
        outcome: "SUCCESS",
      });
    });
    return raw;
  }
  async getSession(raw: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenDigest: digest(raw) },
      include: {
        user: {
          include: {
            customer: true,
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    )
      return null;
    return {
      user: this.publicUser(session.user),
      permissions: session.user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.key),
      ),
      sessionId: session.id,
    };
  }
  async logout(raw?: string) {
    if (!raw) return;
    const session = await this.prisma.session.findUnique({
      where: { tokenDigest: digest(raw) },
    });
    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorUserId: session.userId,
        action: "SESSION_REVOKED",
        targetType: "Session",
        targetId: session.id,
        outcome: "SUCCESS",
      });
    }
  }
  async updateProfile(userId: string, displayName: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) throw new BadRequestException("Customer profile not found.");
    const updated = await this.prisma.customer.update({
      where: { userId },
      data: { displayName: displayName.trim() },
      select: { displayName: true },
    });
    await this.audit.record({
      actorUserId: userId,
      action: "CUSTOMER_PROFILE_UPDATED",
      targetType: "Customer",
      targetId: customer.id,
      outcome: "SUCCESS",
    });
    return updated;
  }
  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }
  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count)
      throw new BadRequestException("Session not found or already revoked.");
    await this.audit.record({
      actorUserId: userId,
      action: "SESSION_REVOKED",
      targetType: "Session",
      targetId: sessionId,
      outcome: "SUCCESS",
    });
    return { message: "Session revoked." };
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    await this.throttle(`password-change:${digest(userId)}`, 5, 900);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, status: true },
    });
    if (
      !user?.passwordHash ||
      user.status !== "ACTIVE" ||
      !(await argon2
        .verify(user.passwordHash, currentPassword)
        .catch(() => false))
    )
      throw new UnauthorizedException("Current password is incorrect.");
    if (currentPassword === newPassword)
      throw new BadRequestException("Choose a different password.");
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          status: "ACTIVE",
          passwordHash: user.passwordHash,
        },
        data: { passwordHash, mustChangePassword: false },
      });
      if (updated.count !== 1)
        throw new ConflictException("Your account changed. Sign in again.");
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.recordInTransaction(tx, {
        actorUserId: userId,
        action: "PASSWORD_CHANGED",
        targetType: "User",
        targetId: userId,
        outcome: "SUCCESS",
      });
    });
    return { message: "Password changed. Sign in again." };
  }
  async requestPasswordReset(emailInput: string, ip = "unknown") {
    const email = emailInput.trim().toLowerCase();
    await this.throttle(`reset:email:${email}`, 3, 900);
    await this.throttle(`reset:ip:${digest(ip)}`, 10, 900);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.emailVerifiedAt)
      await this.issueCode(user.id, email, "PASSWORD_RESET");
    return {
      message: "If the account exists, a password reset code has been sent.",
    };
  }
  async resetPassword(emailInput: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: emailInput.trim().toLowerCase() },
    });
    if (!user) throw new BadRequestException("Invalid or expired reset code.");
    const challenge = await this.prisma.verificationChallenge.findFirst({
      where: {
        subjectId: user.id,
        purpose: "PASSWORD_RESET",
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
    if (
      !challenge ||
      !this.digestMatches(
        code,
        challenge.id,
        Buffer.from(challenge.codeDigest, "hex"),
      )
    ) {
      if (challenge)
        await this.prisma.verificationChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
      throw new BadRequestException("Invalid or expired reset code.");
    }
    await this.prisma.$transaction([
      this.prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await argon2.hash(newPassword, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
          }),
          mustChangePassword: false,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorUserId: user.id,
      action: "PASSWORD_RESET",
      targetType: "User",
      targetId: user.id,
      outcome: "SUCCESS",
    });
    return { message: "Password reset successfully. Sign in again." };
  }
  private encryptionKey() {
    const raw = process.env.MFA_ENCRYPTION_KEY;
    if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw))
      throw new Error("MFA_ENCRYPTION_KEY must be 32-byte hex");
    return Buffer.from(raw, "hex");
  }
  private encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((b) => b.toString("base64"))
      .join(".");
  }
  private decryptSecret(value: string) {
    const [iv, tag, encrypted] = value
      .split(".")
      .map((v) => Buffer.from(v, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }
  async setupMfa(userId: string) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (currentUser.mfaEnabled)
      throw new BadRequestException(
        "MFA is already enabled. Verify your current authenticator before changing it.",
      );
    const secret = authenticator.generateSecret();
    const uri = authenticator.keyuri(userId, "Trueman Logistics", secret);
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(5).toString("hex").toUpperCase(),
    );
    await this.prisma.mfaConfiguration.upsert({
      where: { userId },
      create: {
        userId,
        encryptedSecret: this.encryptSecret(secret),
        recoveryCodeDigests: recoveryCodes.map(digest),
      },
      update: {
        encryptedSecret: this.encryptSecret(secret),
        recoveryCodeDigests: recoveryCodes.map(digest),
        enabledAt: null,
      },
    });
    return {
      qrCodeDataUrl: await QRCode.toDataURL(uri),
      recoveryCodes,
      message:
        "Scan the QR code and verify a code to enable MFA. Store recovery codes securely.",
    };
  }
  async enableMfa(userId: string, code: string) {
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });
    if (
      !config ||
      !authenticator.check(code, this.decryptSecret(config.encryptedSecret))
    )
      throw new BadRequestException("Invalid authenticator code.");
    await this.prisma.$transaction([
      this.prisma.mfaConfiguration.update({
        where: { userId },
        data: { enabledAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      }),
    ]);
    await this.audit.record({
      actorUserId: userId,
      action: "MFA_ENABLED",
      targetType: "User",
      targetId: userId,
      outcome: "SUCCESS",
    });
    return { message: "Multi-factor authentication enabled." };
  }
  async disableMfa(userId: string, code: string) {
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });
    if (
      !config ||
      !authenticator.check(code, this.decryptSecret(config.encryptedSecret))
    )
      throw new BadRequestException("Invalid authenticator code.");
    await this.prisma.$transaction([
      this.prisma.mfaConfiguration.delete({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false },
      }),
    ]);
    await this.audit.record({
      actorUserId: userId,
      action: "MFA_DISABLED",
      targetType: "User",
      targetId: userId,
      outcome: "SUCCESS",
    });
    return { message: "Multi-factor authentication disabled." };
  }
}
