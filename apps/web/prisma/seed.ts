import { PrismaClient, OrganizationStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BUREAU_ADMIN_EMAIL;
  const password = process.env.BUREAU_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("BUREAU_ADMIN_EMAIL et BUREAU_ADMIN_PASSWORD requis pour le seed");
  }
  const hash = await bcrypt.hash(password, 12);
  const orgName = process.env.BUREAU_ORG_NAME ?? "Kod Digor";
  const orgSlug = process.env.BUREAU_ORG_SLUG ?? "kod-digor";

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {
      name: orgName,
      status: OrganizationStatus.APPROVED,
      approvedAt: new Date(),
    },
    create: {
      name: orgName,
      slug: orgSlug,
      presentation: "Association hébergeuse de la plateforme Framm.",
      status: OrganizationStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      role: UserRole.BUREAU,
      organizationId: org.id,
    },
    create: {
      email,
      passwordHash: hash,
      role: UserRole.BUREAU,
      organizationId: org.id,
    },
  });

  console.log(`Bureau admin seeded: ${email} (org: ${org.name})`);
}

main()
  .finally(() => prisma.$disconnect());
