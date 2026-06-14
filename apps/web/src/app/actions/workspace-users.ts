"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import type { ActionResult } from "@/lib/action-result";
import { MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { sealSecret } from "@/lib/crypto/seal";
import { prisma } from "@/lib/prisma";
import {
  createAccount,
  deleteAccount,
  extractStalwartCreatedId,
  extractStalwartOrphanAccountId,
  extractStalwartSetIssue,
  isStalwartFailure,
  isStalwartDomainIssue,
  isStalwartPasswordIssue,
  isStalwartTransportIssue,
  resolveStalwartAccountId,
  resolveStalwartDomainId,
  updateAccount,
  updateAccountPassword,
} from "@/lib/stalwart/client";
import {
  domainFqdnFromCanonical,
  isSameAsPrimary,
  localPrefixFromCanonical,
  parseAddressPatternInput,
  validatePatternDomain,
} from "@/lib/mail/address-pattern";
import {
  deprovisionMailboxAddressPattern,
  provisionMailboxAddressPattern,
} from "@/lib/mail/mailbox-address-provision";
import { validateAddressPatternConflicts } from "@/lib/mail/validate-address-pattern";
import { UserRole } from "@prisma/client";

async function resolveOrgDomainByFqdn(orgId: string, fqdn: string) {
  const domain = await prisma.domain.findFirst({
    where: {
      organizationId: orgId,
      fqdn,
      status: { in: MAIL_USABLE_DOMAIN_STATUSES },
    },
  });
  if (!domain) return null;

  const domainResolved = await resolveStalwartDomainId(domain.fqdn, domain.stalwartDomainId);
  if (domainResolved.unavailable || !domainResolved.id) return null;

  if (!domain.stalwartDomainId) {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { stalwartDomainId: domainResolved.id },
    });
  }

  return { domain, stalwartDomainId: domainResolved.id };
}

type StalwartAccountProvisionResult =
  | { ok: true; stalwartAccountId: string }
  | { ok: false; message: string };

async function provisionStalwartAccount(
  localPart: string,
  stalwartDomainId: string,
  password: string,
  displayName: string | null,
  logContext: string
): Promise<StalwartAccountProvisionResult> {
  const stalwartRes = await createAccount(
    localPart,
    stalwartDomainId,
    password,
    displayName
  );

  if (!isStalwartFailure(stalwartRes)) {
    const stalwartAccountId = extractStalwartCreatedId(stalwartRes);
    if (!stalwartAccountId) {
      console.error(`[${logContext}] Stalwart create succeeded without account id`);
      return { ok: false, message: "stalwartError" };
    }
    return { ok: true, stalwartAccountId };
  }

  const issue = extractStalwartSetIssue(stalwartRes);

  if (issue?.type === "unavailable" || isStalwartTransportIssue(issue)) {
    return { ok: false, message: "stalwartUnavailable" };
  }
  if (isStalwartPasswordIssue(issue)) {
    return { ok: false, message: "passwordWeak" };
  }
  if (isStalwartDomainIssue(issue)) {
    return { ok: false, message: "domainError" };
  }

  const orphanId = extractStalwartOrphanAccountId(issue);
  if (orphanId) {
    const pwdRes = await updateAccountPassword(orphanId, password);
    if (isStalwartFailure(pwdRes)) {
      const pwdIssue = extractStalwartSetIssue(pwdRes);
      if (isStalwartPasswordIssue(pwdIssue)) {
        return { ok: false, message: "passwordWeak" };
      }
      return { ok: false, message: "stalwartError" };
    }
    if (displayName) {
      const descRes = await updateAccount(orphanId, { description: displayName });
      if (isStalwartFailure(descRes)) {
        return { ok: false, message: "stalwartError" };
      }
    }
    return { ok: true, stalwartAccountId: orphanId };
  }

  if (issue?.type === "primaryKeyViolation") {
    return { ok: false, message: "exists" };
  }

  console.error(
    `[${logContext}] Stalwart create failed:`,
    issue?.type ?? "unknown",
    issue?.description ?? issue ?? stalwartRes
  );
  return { ok: false, message: "stalwartError" };
}

async function resolveOrgDomain(orgId: string, domainId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
  });
  if (!domain) return null;
  return resolveOrgDomainByFqdn(orgId, domain.fqdn);
}

export async function createWorkspaceUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const password = (formData.get("password") as string) ?? "";
  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;

  if (!localPart || password.length < 8) {
    return { ok: false, message: "invalid" };
  }

  const domainCtx = await resolveOrgDomain(orgId, domainId);
  if (!domainCtx) return { ok: false, message: "domainError" };

  const email = `${localPart}@${domainCtx.domain.fqdn}`;
  const address = email;

  const addressTaken =
    (await prisma.mailbox.findUnique({ where: { address } })) ??
    (await prisma.mailboxAddress.findUnique({ where: { address } })) ??
    (await prisma.sharedMailbox.findUnique({ where: { address } }));

  if (addressTaken) return { ok: false, message: "exists" };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const member = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
    });
    if (member) return { ok: false, message: "userExists" };
  }

  const provisioned = await provisionStalwartAccount(
    localPart,
    domainCtx.stalwartDomainId,
    password,
    displayName,
    "createWorkspaceUser"
  );
  if (!provisioned.ok) {
    return { ok: false, message: provisioned.message };
  }
  const stalwartAccountId = provisioned.stalwartAccountId;

  const hash = await bcrypt.hash(password, 12);
  const credentialsEnc = await sealSecret(password);

  await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          passwordHash: hash,
          displayName,
          mustChangePassword: true,
          role: UserRole.ASSOC_MEMBER,
        },
      }));

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { displayName: displayName ?? existingUser.displayName },
      });
    }

    await tx.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role: UserRole.ASSOC_MEMBER,
      },
    });

    const mailbox = await tx.mailbox.create({
      data: {
        organizationId: orgId,
        domainId: domainCtx.domain.id,
        address,
        displayName,
        stalwartAccountId,
        credentialsEnc,
      },
    });

    await tx.userMailbox.create({
      data: {
        userId: user.id,
        mailboxId: mailbox.id,
        organizationId: orgId,
        isPrimary: true,
      },
    });
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "created", detail: address };
}

export async function addMailboxAddressAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const mailboxId = formData.get("mailboxId") as string;
  const addressOrPattern = (formData.get("addressOrPattern") as string)?.trim() ?? "";
  const domainId = (formData.get("domainId") as string) ?? "";

  if (!mailboxId || !addressOrPattern) return { ok: false, message: "invalid" };

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const orgDomains = await prisma.domain.findMany({
    where: { organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
    select: { id: true, fqdn: true },
  });
  const fallbackFqdn = orgDomains.find((d) => d.id === domainId)?.fqdn ?? orgDomains[0]?.fqdn;

  const parsedResult = parseAddressPatternInput(addressOrPattern, fallbackFqdn);
  if (!parsedResult.ok) {
    if (parsedResult.code === "dangerousPattern") {
      return { ok: false, message: "patternTooBroad" };
    }
    return { ok: false, message: "invalidPattern" };
  }

  const domainCheck = validatePatternDomain(
    parsedResult.parsed,
    orgDomains.map((d) => d.fqdn)
  );
  if (!domainCheck.ok) return { ok: false, message: "domainError" };

  if (isSameAsPrimary(parsedResult.parsed, mailbox.address)) {
    return { ok: false, message: "sameAsPrimary" };
  }

  const domainCtx = await resolveOrgDomainByFqdn(orgId, parsedResult.parsed.domainFqdn);
  if (!domainCtx) return { ok: false, message: "domainError" };

  const canonical = parsedResult.parsed.canonical;

  const existingRow = await prisma.mailboxAddress.findUnique({ where: { address: canonical } });
  if (existingRow) return { ok: false, message: "exists" };

  if (parsedResult.parsed.patternType === "EXACT") {
    const mailboxTaken = await prisma.mailbox.findUnique({ where: { address: canonical } });
    const sharedTaken = await prisma.sharedMailbox.findUnique({ where: { address: canonical } });
    if (mailboxTaken || sharedTaken) return { ok: false, message: "exists" };
  }

  if (parsedResult.parsed.patternType === "WILDCARD_DOMAIN") {
    const existingCatchAll = await prisma.mailboxAddress.findFirst({
      where: {
        organizationId: orgId,
        patternType: "WILDCARD_DOMAIN",
        address: canonical,
        NOT: { mailboxId: mailbox.id },
      },
    });
    if (existingCatchAll) return { ok: false, message: "catchAllConflict" };
  }

  const conflictCheck = await validateAddressPatternConflicts({
    orgId,
    mailboxId: mailbox.id,
    mailboxAddress: mailbox.address,
    parsed: parsedResult.parsed,
    stalwartDomainId: domainCtx.stalwartDomainId,
  });
  if (!conflictCheck.ok) {
    return { ok: false, message: conflictCheck.code };
  }

  const provisioned = await provisionMailboxAddressPattern({
    parsed: parsedResult.parsed,
    mailboxAddress: mailbox.address,
    stalwartDomainId: domainCtx.stalwartDomainId,
    stalwartAccountId: mailbox.stalwartAccountId,
    mailboxDisplayName: mailbox.displayName,
  });

  if ("error" in provisioned) {
    if (provisioned.error === "catchAllConflict") {
      return { ok: false, message: "catchAllConflict" };
    }
    if (provisioned.error === "localPatternConflict") {
      return { ok: false, message: "localPatternConflict" };
    }
    if (provisioned.error === "sendIdentityError") {
      return { ok: false, message: "sendIdentityError" };
    }
    return { ok: false, message: "stalwartError" };
  }

  await prisma.mailboxAddress.create({
    data: {
      organizationId: orgId,
      mailboxId: mailbox.id,
      address: canonical,
      patternType: parsedResult.parsed.patternType,
      stalwartAliasId: provisioned.stalwartAliasId,
    },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "addressAdded", detail: canonical };
}

export async function removeMailboxAddressAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const addressId = formData.get("addressId") as string;
  const row = await prisma.mailboxAddress.findFirst({
    where: { id: addressId, organizationId: orgId },
    include: { mailbox: true },
  });
  if (!row) return;

  const domainFqdn = domainFqdnFromCanonical(row.address);
  const domainCtx = domainFqdn ? await resolveOrgDomainByFqdn(orgId, domainFqdn) : null;

  if (domainCtx) {
    const ok = await deprovisionMailboxAddressPattern({
      patternType: row.patternType,
      address: row.address,
      localPrefix: localPrefixFromCanonical(row.address),
      mailboxAddress: row.mailbox.address,
      stalwartDomainId: domainCtx.stalwartDomainId,
      stalwartAccountId: row.mailbox.stalwartAccountId,
      stalwartAliasId: row.stalwartAliasId,
    });
    if (!ok) return;
  }

  await prisma.mailboxAddress.delete({ where: { id: row.id } });
  revalidatePath("/dashboard/users");
}

export async function associateMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const memberId = formData.get("memberId") as string;
  const password = (formData.get("password") as string) ?? "";

  if (!memberId || password.length < 8) {
    return { ok: false, message: "invalid" };
  }

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: {
      user: {
        include: {
          mailboxes: { where: { organizationId: orgId } },
        },
      },
    },
  });
  if (!member) return { ok: false, message: "notfound" };

  if (member.user.mailboxes.length > 0) {
    return { ok: false, message: "mailboxExists" };
  }

  const email = member.user.email.toLowerCase();
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return { ok: false, message: "invalidEmail" };

  const localPart = email.slice(0, atIndex);
  const domainFqdn = email.slice(atIndex + 1);

  const domain = await prisma.domain.findFirst({
    where: {
      organizationId: orgId,
      fqdn: domainFqdn,
      status: { in: MAIL_USABLE_DOMAIN_STATUSES },
    },
  });
  if (!domain) return { ok: false, message: "emailDomainMismatch" };

  const domainCtx = await resolveOrgDomain(orgId, domain.id);
  if (!domainCtx) return { ok: false, message: "domainError" };

  const address = email;
  const addressTaken =
    (await prisma.mailbox.findUnique({ where: { address } })) ??
    (await prisma.mailboxAddress.findUnique({ where: { address } })) ??
    (await prisma.sharedMailbox.findUnique({ where: { address } }));

  if (addressTaken) return { ok: false, message: "exists" };

  const displayName = member.user.displayName;

  const provisioned = await provisionStalwartAccount(
    localPart,
    domainCtx.stalwartDomainId,
    password,
    displayName,
    "associateMailbox"
  );
  if (!provisioned.ok) {
    return { ok: false, message: provisioned.message };
  }
  const stalwartAccountId = provisioned.stalwartAccountId;

  const hash = await bcrypt.hash(password, 12);
  const credentialsEnc = await sealSecret(password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: member.userId },
      data: {
        passwordHash: hash,
        mustChangePassword: true,
      },
    });

    const mailbox = await tx.mailbox.create({
      data: {
        organizationId: orgId,
        domainId: domainCtx.domain.id,
        address,
        displayName,
        stalwartAccountId,
        credentialsEnc,
      },
    });

    await tx.userMailbox.create({
      data: {
        userId: member.userId,
        mailboxId: mailbox.id,
        organizationId: orgId,
        isPrimary: true,
      },
    });
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "mailboxAssociated", detail: address };
}

export async function updateWorkspaceUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const memberId = formData.get("memberId") as string;
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;
  const password = (formData.get("password") as string) ?? "";

  if (!memberId) return null;

  if (password && password.length < 8) {
    return { ok: false, message: "passwordError" };
  }

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: {
      user: {
        include: {
          mailboxes: {
            where: { organizationId: orgId, isPrimary: true },
            include: { mailbox: true },
          },
        },
      },
    },
  });
  if (!member) return { ok: false, message: "notfound" };

  const primaryLink = member.user.mailboxes[0];
  const mailbox = primaryLink?.mailbox ?? null;

  const nameChanged = (member.user.displayName ?? mailbox?.displayName ?? "") !== (displayName ?? "");
  const passwordChanged = password.length > 0;

  if (!nameChanged && !passwordChanged) {
    revalidatePath("/dashboard/users");
    return null;
  }

  if (mailbox) {
    const resolved = await resolveStalwartAccountId(mailbox.stalwartAccountId, mailbox.address);
    if (resolved.unavailable) {
      return { ok: false, message: "stalwartUnavailable" };
    }

    if (resolved.id && nameChanged) {
      const stalwartRes = await updateAccount(resolved.id, { description: displayName });
      if (isStalwartFailure(stalwartRes)) {
        return { ok: false, message: "stalwartError" };
      }
    }

    if (passwordChanged) {
      if (!resolved.id) {
        return { ok: false, message: "stalwartError" };
      }
      const pwdRes = await updateAccountPassword(resolved.id, password);
      if (isStalwartFailure(pwdRes)) {
        const issue = extractStalwartSetIssue(pwdRes);
        if (isStalwartPasswordIssue(issue)) {
          return { ok: false, message: "passwordWeak" };
        }
        if (isStalwartTransportIssue(issue)) {
          return { ok: false, message: "stalwartUnavailable" };
        }
        return { ok: false, message: "stalwartError" };
      }
    }

    const mailboxData: {
      displayName: string | null;
      credentialsEnc?: string;
      stalwartAccountId?: string;
    } = { displayName };
    if (passwordChanged) mailboxData.credentialsEnc = await sealSecret(password);
    if (resolved.id && !mailbox.stalwartAccountId) mailboxData.stalwartAccountId = resolved.id;

    await prisma.mailbox.update({ where: { id: mailbox.id }, data: mailboxData });
  }

  const userData: {
    displayName: string | null;
    passwordHash?: string;
  } = { displayName };
  if (passwordChanged) userData.passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: member.userId },
    data: userData,
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/mailboxes");
  return {
    ok: true,
    message: "updated",
    detail: mailbox?.address ?? member.user.email,
  };
}

export async function removeWorkspaceUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const memberId = formData.get("memberId") as string;
  if (!memberId) return null;

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: orgId },
    include: {
      user: {
        include: {
          mailboxes: {
            where: { organizationId: orgId },
            include: { mailbox: { include: { alternateAddresses: true } } },
          },
        },
      },
    },
  });
  if (!member) return { ok: false, message: "notfound" };

  if (member.userId === session.user.id) {
    return { ok: false, message: "cannotDeleteSelf" };
  }

  for (const link of member.user.mailboxes) {
    const mailbox = link.mailbox;

    for (const alt of mailbox.alternateAddresses) {
      const domainFqdn = domainFqdnFromCanonical(alt.address);
      const domainCtx = domainFqdn ? await resolveOrgDomainByFqdn(orgId, domainFqdn) : null;

      if (domainCtx) {
        const ok = await deprovisionMailboxAddressPattern({
          patternType: alt.patternType,
          address: alt.address,
          localPrefix: localPrefixFromCanonical(alt.address),
          mailboxAddress: mailbox.address,
          stalwartDomainId: domainCtx.stalwartDomainId,
          stalwartAccountId: mailbox.stalwartAccountId,
          stalwartAliasId: alt.stalwartAliasId,
        });
        if (!ok) {
          return { ok: false, message: "stalwartError" };
        }
      }
    }

    const accountResolved = await resolveStalwartAccountId(
      mailbox.stalwartAccountId,
      mailbox.address
    );
    if (accountResolved.unavailable) {
      return { ok: false, message: "stalwartUnavailable" };
    }
    if (accountResolved.id) {
      const delAccountRes = await deleteAccount(accountResolved.id);
      if (isStalwartFailure(delAccountRes)) {
        return { ok: false, message: "stalwartError" };
      }
    }

    await prisma.mailbox.delete({ where: { id: mailbox.id } });
  }

  await prisma.organizationMember.delete({ where: { id: member.id } });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "deleted", detail: member.user.email };
}
