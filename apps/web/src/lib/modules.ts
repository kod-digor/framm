import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "@prisma/client";

export type OrgModuleFlags = {
  mail: boolean;
  calendar: boolean;
  accounting: boolean;
  members: boolean;
};

export const DEFAULT_ORG_MODULES: OrgModuleFlags = {
  mail: true,
  calendar: false,
  accounting: false,
  members: false,
};

export async function getOrganizationModules(organizationId: string): Promise<OrgModuleFlags> {
  const row = await prisma.organizationModule.findUnique({ where: { organizationId } });
  if (!row) return DEFAULT_ORG_MODULES;
  return {
    mail: row.mail,
    calendar: row.calendar,
    accounting: row.accounting,
    members: row.members,
  };
}

export async function getSubscription(organizationId: string) {
  return prisma.subscription.findUnique({ where: { organizationId } });
}

export async function ensureOrgBillingRecords(organizationId: string) {
  await prisma.organizationModule.upsert({
    where: { organizationId },
    create: { organizationId, ...DEFAULT_ORG_MODULES },
    update: {},
  });
  await prisma.subscription.upsert({
    where: { organizationId },
    create: { organizationId, status: "PENDING_PAYMENT" },
    update: {},
  });
}

export function isSubscriptionActive(status: SubscriptionStatus | null | undefined): boolean {
  return status === "ACTIVE";
}

export function requiresBillingSetup(status: SubscriptionStatus | null | undefined): boolean {
  return status === "PENDING_PAYMENT" || status === "PAST_DUE";
}

export async function activateSubscription(
  organizationId: string,
  payplugPaymentId?: string,
  payplugCustomerId?: string
) {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      status: "ACTIVE",
      ...(payplugPaymentId ? { payplugPaymentId } : {}),
      ...(payplugCustomerId ? { payplugCustomerId } : {}),
    },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
}

export type ModuleKey = keyof OrgModuleFlags;

export { MODULE_KEYS } from "@/lib/modules-catalog";
