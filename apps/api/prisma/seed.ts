import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const permissions = [
  ['customer:profile:read', 'Read own customer profile'],
  ['customer:profile:update', 'Update own customer profile'],
  ['shipments:read:assigned', 'Read assigned shipments'],
  ['shipments:manage', 'Manage shipment operations'],
  ['rates:manage', 'Create and manage shipping rate rules'],
  ['warehouse:manage', 'Manage warehouse operations'],
  ['delivery:manage:assigned', 'Manage assigned deliveries'],
  ['finance:read', 'Read financial records'],
  ['finance:manage', 'Manage financial records'],
  ['support:manage', 'Manage customer support cases'],
  ['staff:manage', 'Manage staff accounts'],
  ['roles:manage', 'Manage roles and permissions'],
  ['system:manage', 'Manage system configuration'],
  ['audit:read', 'Read security and audit events'],
];
const rolePermissions: Record<string, string[]> = {
  CUSTOMER: ['customer:profile:read', 'customer:profile:update'],
  SUPER_ADMINISTRATOR: permissions.map(([key]) => key),
  ADMINISTRATOR: ['shipments:read:assigned', 'shipments:manage', 'rates:manage', 'warehouse:manage', 'delivery:manage:assigned', 'finance:read', 'support:manage', 'staff:manage', 'audit:read'],
  OPERATIONS_MANAGER: ['shipments:read:assigned', 'shipments:manage', 'rates:manage', 'warehouse:manage', 'delivery:manage:assigned', 'support:manage'],
  SHIPMENT_OFFICER: ['shipments:read:assigned', 'shipments:manage'],
  WAREHOUSE_PERSONNEL: ['shipments:read:assigned', 'warehouse:manage'],
  DELIVERY_PERSONNEL: ['shipments:read:assigned', 'delivery:manage:assigned'],
  FINANCE_OFFICER: ['finance:read', 'finance:manage'],
  CUSTOMER_SUPPORT: ['shipments:read:assigned', 'support:manage'],
};
async function main() {
  for (const [key, description] of permissions) await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  for (const [name, keys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({ where: { name }, create: { name, description: `${name.replaceAll('_', ' ').toLowerCase()} access role` }, update: {} });
    for (const key of keys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
    }
  }
  process.stdout.write('Trueman roles and permissions seeded. No administrator account was created.\n');
}
main().finally(() => prisma.$disconnect());
