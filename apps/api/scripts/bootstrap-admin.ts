import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME;
  const employeeCode = process.env.BOOTSTRAP_ADMIN_EMPLOYEE_CODE;
  if (!email || !password || !fullName || !employeeCode) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_EMPLOYEE_CODE.');
  if (password.length < 14) throw new Error('Bootstrap administrator password must contain at least 14 characters.');
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMINISTRATOR' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('An account with this email already exists. Refusing to overwrite it.');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const user = await prisma.user.create({ data: { email, passwordHash, emailVerifiedAt: new Date(), status: 'ACTIVE', staff: { create: { employeeCode, fullName } }, userRoles: { create: { roleId: role.id } } }, select: { id: true, email: true } });
  process.stdout.write(`Privileged bootstrap account created for ${user.email}. Sign in and enroll MFA immediately.\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : 'Bootstrap failed'}\n`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
