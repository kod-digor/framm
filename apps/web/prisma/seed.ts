import { PrismaClient, OrganizationStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ORG_MODULES } from "../src/lib/modules";

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
      status: OrganizationStatus.APPROVED,
      approvedAt: new Date(),
      modules: { create: DEFAULT_ORG_MODULES },
      subscription: { create: { status: "ACTIVE" } },
    },
  });

  await prisma.organizationModule.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, ...DEFAULT_ORG_MODULES },
    update: {},
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      role: UserRole.BUREAU,
    },
    create: {
      email,
      passwordHash: hash,
      role: UserRole.BUREAU,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: org.id },
    },
    update: { role: UserRole.BUREAU },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: UserRole.BUREAU,
    },
  });

  console.log(`Bureau admin seeded: ${email} (org: ${org.name})`);
}

main().finally(() => prisma.$disconnect());
