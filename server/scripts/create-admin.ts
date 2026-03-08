import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@local.ma";
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Admin";

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log("User already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash, name, role: "admin" }
  });
  console.log("Admin created:", email, "password:", password);
}

main().finally(() => prisma.$disconnect());