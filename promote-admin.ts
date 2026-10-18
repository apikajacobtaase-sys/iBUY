 // promote-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MY_EMAIL = "ibuysupportghana@gmail.com"; 
const NEW_PASSWORD = "jacobibuy123"; 

async function main() {
  console.log(`🔍 Checking for user: ${MY_EMAIL}...`);

  let user = await prisma.user.findUnique({
    where: { email: MY_EMAIL },
  });

  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

  if (!user) {
    console.log("⚠️ User not found. Creating new Super Admin account...");
    user = await prisma.user.create({
      data: {
        email: MY_EMAIL,
        passwordHash: hashedPassword,
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN", // ✅ Set role immediately on creation
        isActive: true,
      },
    });
    console.log("✅ New Admin Account Created!");
  } else {
    console.log("✅ User found. Updating role and password...");
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        role: 'SUPER_ADMIN',
        passwordHash: hashedPassword,
      },
    });
  }

  console.log(`🚀 SUCCESS! Email: ${MY_EMAIL}`);
  console.log(`🔑 Password: ${NEW_PASSWORD}`);
  console.log("⚠️ Please log out and log back in on the live site.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });