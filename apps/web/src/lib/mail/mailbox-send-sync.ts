import { prisma } from "@/lib/prisma";
import { MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { domainFqdnFromCanonical } from "@/lib/mail/address-pattern";
import { syncMailboxSendIdentities } from "@/lib/mail/mailbox-send-identities";
import { resolveStalwartAccountId } from "@/lib/stalwart/client";

/** Synchronise les identités d'envoi Bulwark pour une boîte (best-effort). */
export async function repairMailboxSendIdentities(mailboxId: string): Promise<void> {
  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId },
    select: {
      id: true,
      address: true,
      displayName: true,
      stalwartAccountId: true,
      organizationId: true,
      alternateAddresses: {
        where: { patternType: "EXACT" },
        select: { address: true },
      },
    },
  });
  if (!mailbox || mailbox.alternateAddresses.length === 0) return;

  const accountResolved = await resolveStalwartAccountId(
    mailbox.stalwartAccountId,
    mailbox.address
  );
  if (accountResolved.unavailable || !accountResolved.id) return;

  const orgDomains = await prisma.domain.findMany({
    where: {
      organizationId: mailbox.organizationId,
      status: { in: MAIL_USABLE_DOMAIN_STATUSES },
    },
    select: { fqdn: true, stalwartDomainId: true },
  });
  const domainByFqdn = new Map(orgDomains.map((d) => [d.fqdn, d.stalwartDomainId]));

  for (const row of mailbox.alternateAddresses) {
    const fqdn = domainFqdnFromCanonical(row.address);
    const stalwartDomainId = fqdn ? domainByFqdn.get(fqdn) : undefined;
    if (!stalwartDomainId) continue;

    await syncMailboxSendIdentities({
      stalwartAccountId: accountResolved.id,
      stalwartDomainId,
      displayName: mailbox.displayName,
      exactAliasEmails: [row.address],
    });
  }

  if (!mailbox.stalwartAccountId && accountResolved.id) {
    await prisma.mailbox.update({
      where: { id: mailbox.id },
      data: { stalwartAccountId: accountResolved.id },
    });
  }
}

/** Vérifie que Stalwart est joignable avant une sync (tests / garde-fou). */
export function isSendIdentitySyncAvailable(): boolean {
  return Boolean(process.env.STALWART_API_KEY && process.env.STALWART_URL);
}
