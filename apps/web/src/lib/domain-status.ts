import type { DomainStatus } from "@prisma/client";

/** Domaines utilisables pour boîtes mail, redirections et sync Stalwart. */
export const MAIL_USABLE_DOMAIN_STATUSES: DomainStatus[] = [
  "VERIFIED",
  "ACTIVE",
  "PENDING_DNS",
];

export function isDnsVerifiedDomainStatus(status: DomainStatus): boolean {
  return status === "VERIFIED" || status === "ACTIVE";
}
