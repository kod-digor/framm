import { syncPricingIfStale } from "@/lib/billing/pricing";
import { processMonthlyWalletDeductions } from "@/lib/billing/wallet";
import { prisma } from "@/lib/prisma";
import { getOrgStorageBytes } from "@/lib/storage/s3";

const DAY_MS = 24 * 60 * 60 * 1000;

async function syncUsage() {
  const orgs = await prisma.organization.findMany({ where: { status: "APPROVED" } });
  const recordedAt = new Date();

  for (const org of orgs) {
    const storage = await getOrgStorageBytes(org.id);
    const mailboxCount = await prisma.mailbox.count({ where: { organizationId: org.id } });
    const domainCount = await prisma.domain.count({
      where: { organizationId: org.id, status: { in: ["VERIFIED", "ACTIVE"] } },
    });

    await prisma.usageSnapshot.createMany({
      data: [
        { organizationId: org.id, metric: "STORAGE_BYTES", value: storage, recordedAt },
        { organizationId: org.id, metric: "MAILBOX_COUNT", value: BigInt(mailboxCount), recordedAt },
        { organizationId: org.id, metric: "DOMAIN_COUNT", value: BigInt(domainCount), recordedAt },
      ],
    });
  }
}

async function run() {
  console.log("Framm worker started");
  await syncPricingIfStale();
  await syncUsage();
  const deducted = await processMonthlyWalletDeductions();
  if (deducted > 0) {
    console.log(`Wallet: ${deducted} monthly consumption(s) deducted`);
  }

  setInterval(syncUsage, DAY_MS);
  setInterval(() => {
    void syncPricingIfStale();
  }, DAY_MS);
  setInterval(() => {
    void processMonthlyWalletDeductions().then((count) => {
      if (count > 0) console.log(`Wallet: ${count} monthly consumption(s) deducted`);
    });
  }, DAY_MS);
}

run();
