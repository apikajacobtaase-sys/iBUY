// promote-admin.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 👇 REPLACE with the email of the user you want to promote
  const userEmail = "apikajacobtaase@gmail.com"; 
  const newRole = "SUPER_ADMIN"; // or "ADMIN"

  console.log(`🔍 Searching for user: ${userEmail}...`);
  
  const user = await prisma.user.findUnique({ 
    where: { email: userEmail } 
  });

  if (!user) {
    console.log("❌ User not found!");
    return;
  }

  console.log(`✅ Found user! Current role: ${user.role}`);

  if (user.role === newRole) {
    console.log("⚠️ User is already a " + newRole);
    return;
  }

  // Update the role
  await prisma.user.update({
    where: { id: user.id },
    data: { role: newRole }
  });

  console.log(`🎉 SUCCESS! ${user.firstName} is now a ${newRole}.`);
  console.log("Please log out and log back in for the session to update.");
}

main()
  .catch((e) => console.error("❌ Error:", e))
  .finally(async () => await prisma.$disconnect());