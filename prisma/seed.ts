import { PrismaClient, UserRole, Plan } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'tenant-teste' },
    update: {
      name: 'Tenant de Teste',
      email: 'tenant.teste@example.com',
      phone: '+5511999999999',
      plan: Plan.BASIC,
      isActive: true,
    },
    create: {
      name: 'Tenant de Teste',
      slug: 'tenant-teste',
      email: 'tenant.teste@example.com',
      phone: '+5511999999999',
      plan: Plan.BASIC,
      isActive: true,
    },
  });

  const defaultHash = '$2b$12$Q8MQQnrfhL8ZfTXmxCHBvuBHR6cQfEQAWAnf7x6MUA6Pgg6nW2rsu';

  await prisma.user.upsert({
    where: { email: 'superadmin@platform.local' },
    update: {
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      passwordHash: defaultHash,
      isActive: true,
    },
    create: {
      name: 'Super Admin',
      email: 'superadmin@platform.local',
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      passwordHash: defaultHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@tenant-teste.local' },
    update: {
      name: 'Admin Tenant',
      role: UserRole.ADMIN,
      tenantId: tenant.id,
      passwordHash: defaultHash,
      isActive: true,
    },
    create: {
      name: 'Admin Tenant',
      email: 'admin@tenant-teste.local',
      role: UserRole.ADMIN,
      tenantId: tenant.id,
      passwordHash: defaultHash,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
