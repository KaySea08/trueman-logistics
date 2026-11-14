import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.QUOTE_OFFICER_EMAIL?.trim().toLowerCase();
  if (!email)
    throw new Error("Set QUOTE_OFFICER_EMAIL to an existing staff email.");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      status: true,
      staff: { select: { active: true } },
    },
  });
  if (user?.status !== "ACTIVE" || !user.staff?.active)
    throw new Error("The account must have an active user and staff profile.");

  const role = await prisma.role.findUnique({
    where: { name: "QUOTE_OFFICER" },
    select: { id: true },
  });
  if (!role)
    throw new Error("Run the database seed before granting this role.");

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  process.stdout.write(
    "Quote-officer access granted. The staff member must enroll MFA at sign-in.\n",
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Could not grant quote-officer access."}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
