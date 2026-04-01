import { PrismaClient, UserRole, Plan } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

function assertSeedSafety(): void {
  const nodeEnv = process.env.NODE_ENV;
  const allowSeedInProduction = process.env.ALLOW_PRISMA_SEED_IN_PRODUCTION === 'true';

  if (nodeEnv === 'production' && !allowSeedInProduction) {
    throw new Error(
      'Seed bloqueado em producao. Defina ALLOW_PRISMA_SEED_IN_PRODUCTION=true apenas se tiver certeza absoluta.',
    );
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const SEED_DEFAULT_PASSWORD = '12345678';

async function main() {
  assertSeedSafety();

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

  const defaultHash = await bcrypt.hash(SEED_DEFAULT_PASSWORD, 12);

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

  console.log('Seed concluido com sucesso.');
  console.log('Credenciais de desenvolvimento:');
  console.log(`- superadmin@platform.local / ${SEED_DEFAULT_PASSWORD}`);
  console.log(`- admin@tenant-teste.local / ${SEED_DEFAULT_PASSWORD}`);
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
