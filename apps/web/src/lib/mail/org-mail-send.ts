import { prisma } from "@/lib/prisma";
import { isDnsVerifiedDomainStatus } from "@/lib/domain-status";
import {
  decryptMailboxPassword,
  sendOutboundMail,
  sendViaStalwartMailbox,
} from "@/lib/mail/outbound-smtp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OrgMailSendInput = {
  organizationId: string;
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export type OrgMailSendError =
  | "invalid_from"
  | "invalid_to"
  | "missing_content"
  | "domain_not_in_org"
  | "domain_not_verified"
  | "smtp_not_configured"
  | "send_failed";

export function parseEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const addr = (angle?.[1] ?? trimmed).trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) return null;
  return addr;
}

function extractDomain(email: string): string {
  return email.split("@")[1] ?? "";
}

/** Résout l'organisation propriétaire d'un From (domaine vérifié ou non). */
export async function findOrganizationIdByFromAddress(
  from: string
): Promise<string | null> {
  const fromEmail = parseEmailAddress(from);
  if (!fromEmail) return null;
  const domain = await prisma.domain.findFirst({
    where: { fqdn: extractDomain(fromEmail) },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return domain?.organizationId ?? null;
}

export async function validateFromDomainForOrg(
  organizationId: string,
  fromEmail: string
): Promise<OrgMailSendError | null> {
  const domainFqdn = extractDomain(fromEmail);
  const domain = await prisma.domain.findUnique({
    where: {
      organizationId_fqdn: { organizationId, fqdn: domainFqdn },
    },
    select: { status: true },
  });

  if (!domain) return "domain_not_in_org";
  if (!isDnsVerifiedDomainStatus(domain.status)) return "domain_not_verified";
  return null;
}

export async function sendOrgMail(
  input: OrgMailSendInput
): Promise<
  | { ok: true; messageId: string }
  | { ok: false; error: OrgMailSendError; detail?: string }
> {
  const fromEmail = parseEmailAddress(input.from);
  if (!fromEmail) return { ok: false, error: "invalid_from" };

  const toList = Array.isArray(input.to) ? input.to : [input.to];
  const normalizedTo = toList.map((addr) => parseEmailAddress(addr)).filter(Boolean) as string[];
  if (normalizedTo.length === 0 || normalizedTo.length !== toList.length) {
    return { ok: false, error: "invalid_to" };
  }

  if (!input.text?.trim() && !input.html?.trim()) {
    return { ok: false, error: "missing_content" };
  }

  const domainError = await validateFromDomainForOrg(input.organizationId, fromEmail);
  if (domainError) return { ok: false, error: domainError };

  const mailPayload = {
    from: input.from.trim(),
    to: normalizedTo,
    subject: input.subject.trim(),
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  };

  const mailbox = await prisma.mailbox.findFirst({
    where: { organizationId: input.organizationId, address: fromEmail },
    select: { address: true, credentialsEnc: true },
  });
  const mailboxPassword = mailbox?.credentialsEnc
    ? decryptMailboxPassword(mailbox.credentialsEnc)
    : null;

  const result =
    mailbox && mailboxPassword
      ? await sendViaStalwartMailbox(mailbox.address, mailboxPassword, mailPayload)
      : await sendOutboundMail(mailPayload);

  if (!result.ok) {
    return {
      ok: false,
      error: result.code,
      detail: result.detail,
    };
  }

  return { ok: true, messageId: result.messageId };
}
