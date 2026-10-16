// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ibuy.com' },
    update: {},
    create: {
      email: 'admin@ibuy.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // 2. Create Seller User
  const sellerUser = await prisma.user.upsert({
    where: { email: 'seller@ibuy.com' },
    update: {},
    create: {
      email: 'seller@ibuy.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Seller',
      role: 'SELLER',
    },
  });

  // 3. Automatically create the SellerProfile linked to the Seller User
  await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      businessName: 'Test Electronics Store',
      description: 'The best electronics in Ghana',
      commissionRate: 10,
      status: 'ACTIVE', // Adjust based on your schema's enum
    },
  });

  console.log('✅ Seeding complete!');
  console.log('👤 Admin: admin@ibuy.com / password123');
  console.log('🏪 Seller: seller@ibuy.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });