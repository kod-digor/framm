import type { OrganizationStatus, PlatformPricing } from "@prisma/client";
import { estimateStorageCostEur } from "@/lib/billing/pricing";
import { prisma } from "@/lib/prisma";

export type BureauOrgRow = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  presentation: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectReason: string | null;
  adminEmail: string | null;
  mailboxCount: number;
  domainCount: number;
  storageBytes: bigint;
  monthlyCostEur: number | null;
  walletBalanceCents: number;
};

const PLATFORM_SLUG = "kod-digor";

async function loadStorageByOrg() {
  const snapshots = await prisma.usageSnapshot.findMany({
    where: { metric: "STORAGE_BYTES" },
    orderBy: { recordedAt: "desc" },
    select: { organizationId: true, value: true },
  });

  const storageByOrg = new Map<string, bigint>();
  for (const snapshot of snapshots) {
    if (!storageByOrg.has(snapshot.organizationId)) {
      storageByOrg.set(snapshot.organizationId, snapshot.value);
    }
  }
  return storageByOrg;
}

export async function loadBureauOrganizations(
  pricing: PlatformPricing | null
): Promise<BureauOrgRow[]> {
  const [orgs, storageByOrg, domainCounts] = await Promise.all([
    prisma.organization.findMany({
      where: { slug: { not: PLATFORM_SLUG } },
      include: {
        members: {
          include: { user: { select: { email: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        _count: { select: { mailboxes: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    loadStorageByOrg(),
    prisma.domain.groupBy({
      by: ["organizationId"],
      where: { status: { in: ["VERIFIED", "ACTIVE"] } },
      _count: { _all: true },
    }),
  ]);

  const domainCountByOrg = new Map(
    domainCounts.map((row) => [row.organizationId, row._count._all])
  );

  return orgs.map((org) => {
    const storageBytes = storageByOrg.get(org.id) ?? BigInt(0);
    const monthlyCostEur = pricing
      ? estimateStorageCostEur(storageBytes, pricing.storageEurPerGbMonth)
      : null;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      presentation: org.presentation,
      createdAt: org.createdAt,
      approvedAt: org.approvedAt,
      rejectReason: org.rejectReason,
      adminEmail: org.members[0]?.user.email ?? null,
      mailboxCount: org._count.mailboxes,
      domainCount: domainCountByOrg.get(org.id) ?? 0,
      storageBytes,
      monthlyCostEur,
      walletBalanceCents: org.walletBalanceCents,
    };
  });
}

export function summarizeBureauOrgs(orgs: BureauOrgRow[]) {
  const pending = orgs.filter((o) => o.status === "PENDING").length;
  const approved = orgs.filter((o) => o.status === "APPROVED").length;
  const rejected = orgs.filter((o) => o.status === "REJECTED").length;
  const totalMonthlyCost = orgs.reduce((sum, org) => sum + (org.monthlyCostEur ?? 0), 0);

  return {
    total: orgs.length,
    pending,
    approved,
    rejected,
    totalMonthlyCost,
  };
}
