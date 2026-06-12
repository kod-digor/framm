import { prisma } from "@/lib/prisma";
import { getOrgStorageBytes } from "@/lib/storage/s3";

async function syncUsage() {
  const orgs = await prisma.organization.findMany({ where: { status: "APPROVED" } });

  for (const org of orgs) {
    const storage = await getOrgStorageBytes(org.id);
    const mailboxCount = await prisma.mailbox.count({ where: { organizationId: org.id } });
    const domainCount = await prisma.domain.count({
      where: { organizationId: org.id, status: { in: ["VERIFIED", "ACTIVE"] } },
    });

    await prisma.usageSnapshot.createMany({
      data: [
        { organizationId: org.id, metric: "STORAGE_BYTES", value: storage },
        { organizationId: org.id, metric: "MAILBOX_COUNT", value: BigInt(mailboxCount) },
        { organizationId: org.id, metric: "DOMAIN_COUNT", value: BigInt(domainCount) },
      ],
    });
  }
}

async function run() {
  console.log("Framm worker started");
  await syncUsage();
  setInterval(syncUsage, 24 * 60 * 60 * 1000);
}

run();
