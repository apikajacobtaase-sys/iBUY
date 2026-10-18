 // prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create a Category
  const category = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      isActive: true,
      // description: 'Gadgets...', // ❌ Removed: Not in your Category model
    },
  });

  // 2. Create a User (Seller Owner)
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      email: 'seller@example.com',
      passwordHash: hashedPassword, // ✅ Matches your schema
      firstName: 'John',
      lastName: 'Doe',
      role: 'SELLER_OWNER', // ✅ Matches your UserRole enum
      isActive: true,
    },
  });

  // 3. Create a Seller Profile
  const seller = await prisma.sellerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      businessName: 'Tech Haven GH', // ✅ Matches your schema
      description: 'The best electronics in Ghana',
      isActive: true, // ✅ Matches your schema
      verificationStatus: 'VERIFIED', // ✅ Matches your VerificationStatus enum
    },
  });

  // 4. Create a Product
  const product = await prisma.product.create({
    data: {
      title: 'Seed Smartphone',
      slug: 'seed-smartphone',
      description: 'A high-quality smartphone for testing.',
      categoryId: category.id,
      sellerId: seller.id,
      status: 'ACTIVE', // ✅ Matches your ProductStatus enum
      images: {
        create: {
          url: 'https://placehold.co/600x400?text=Smartphone',
          isPrimary: true,
        },
      },
      variants: {
        create: {
          sku: 'SEED-PHONE-001',
          price: 2500.00,
          stockQuantity: 10,
          isActive: true,
          sellerOffers: {
            create: {
              sellerId: seller.id,
              price: 2500.00,
              stockQuantity: 10,
              status: 'ACTIVE', // ✅ Matches your OfferStatus enum
            },
          },
        },
      },
    },
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });