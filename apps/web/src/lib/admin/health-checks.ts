import { connect } from "node:net";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import {
  createAccount,
  createAlias,
  deleteAccount,
  deleteAlias,
  extractStalwartCreatedId,
  getStalwartStatus,
  getWebmailExternalUrl,
  isStalwartFailure,
  resolveStalwartDomainId,
} from "@/lib/stalwart/client";
import { getPlatformEmailDomains } from "@/lib/platform-domains";

export type HealthCheckStatus = "ok" | "fail" | "warn";

export type HealthCheckResult = {
  id: string;
  status: HealthCheckStatus;
  detail?: string;
  durationMs: number;
};

export type HealthCheckDefinition = {
  id: string;
  run: (ctx: HealthCheckContext) => Promise<Omit<HealthCheckResult, "id" | "durationMs">>;
};

export type HealthCheckContext = {
  sessionEmail: string;
  sessionRole: string;
};

const TEST_PASSWORD = "HealthCheck9!FrammSecure";

function resolveAppBaseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const start = Date.now();
  return fn().then((value) => ({ value, durationMs: Date.now() - start }));
}

function checkTcpPort(host: string, port: number, timeoutMs = 5_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.on("connect", () => finish(true));
    socket.on("error", () => finish(false));
    socket.on("timeout", () => finish(false));
  });
}

function parseHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function resolvePlatformStalwartDomainId(): Promise<string | null> {
  const domain = getPlatformEmailDomains()[0];
  if (!domain) return null;
  const resolved = await resolveStalwartDomainId(domain);
  if (resolved.unavailable || !resolved.id) return null;
  return resolved.id;
}

async function checkConnection(ctx: HealthCheckContext) {
  await prisma.$queryRaw`SELECT 1`;
  if (ctx.sessionRole !== "BUREAU") {
    return { status: "fail" as const, detail: "Session non bureau" };
  }
  if (!ctx.sessionEmail) {
    return { status: "fail" as const, detail: "Session sans e-mail" };
  }
  return { status: "ok" as const, detail: `Session ${ctx.sessionEmail}` };
}

async function checkOrgCreate() {
  const slug = `health-check-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: "Health Check (auto)",
      slug,
      presentation: "Test automatique diagnostics Framm — suppression immédiate.",
      status: "PENDING",
    },
  });

  await prisma.organization.delete({ where: { id: org.id } });
  return { status: "ok" as const, detail: "Création et suppression OK" };
}

async function checkOrgApproval() {
  const pendingCount = await prisma.organization.count({ where: { status: "PENDING" } });
  const slug = `health-approve-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: "Health Approve (auto)",
      slug,
      presentation: "Test workflow approbation — suppression immédiate.",
      status: "PENDING",
    },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  const updated = await prisma.organization.findUnique({ where: { id: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });

  if (updated?.status !== "APPROVED") {
    return { status: "fail" as const, detail: "Approbation non persistée" };
  }

  return {
    status: "ok" as const,
    detail: `${pendingCount} demande(s) en attente — workflow OK`,
  };
}

async function checkMailboxCreate() {
  const domainId = await resolvePlatformStalwartDomainId();
  if (!domainId) {
    return { status: "warn" as const, detail: "Domaine plateforme absent dans Stalwart" };
  }

  const localPart = `health-${Date.now()}`;
  const res = await createAccount(localPart, domainId, TEST_PASSWORD, "Health Check");
  if (isStalwartFailure(res)) {
    return { status: "fail" as const, detail: "x:Account/set échoué" };
  }

  const accountId = extractStalwartCreatedId(res);
  if (!accountId) {
    return { status: "fail" as const, detail: "Compte créé sans ID retourné" };
  }

  const destroyRes = await deleteAccount(accountId);
  if (isStalwartFailure(destroyRes)) {
    return { status: "warn" as const, detail: `Compte ${accountId} créé — cleanup JMAP échoué` };
  }

  return { status: "ok" as const, detail: "x:Account/set + destroy OK" };
}

async function checkWebmailAccess() {
  const webmailBase = getWebmailExternalUrl();
  if (!webmailBase) {
    return { status: "warn" as const, detail: "WEBMAIL_URL non configuré" };
  }

  const jmapStatus = await getStalwartStatus();
  if (jmapStatus !== "ok") {
    return { status: "fail" as const, detail: `JMAP: ${jmapStatus}` };
  }

  let webmailHttp = 0;
  try {
    const res = await fetch(webmailBase, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    webmailHttp = res.status;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "fail" as const, detail: `Webmail HTTP: ${detail}` };
  }

  if (webmailHttp >= 500) {
    return { status: "fail" as const, detail: `Webmail HTTP ${webmailHttp}` };
  }

  const appBase = resolveAppBaseUrl();
  let proxyStatus = 0;
  try {
    const proxyRes = await fetch(`${appBase}/webmail/health-check-probe/account/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    proxyStatus = proxyRes.status;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      status: "warn" as const,
      detail: `Webmail HTTP ${webmailHttp} — proxy SSO: ${detail}`,
    };
  }

  if (proxyStatus === 401 || proxyStatus === 403 || proxyStatus === 404) {
    return {
      status: "ok" as const,
      detail: `Webmail HTTP ${webmailHttp} — proxy SSO actif (${proxyStatus})`,
    };
  }

  if (proxyStatus >= 500) {
    return { status: "fail" as const, detail: `Proxy SSO HTTP ${proxyStatus}` };
  }

  return {
    status: "ok" as const,
    detail: `Webmail HTTP ${webmailHttp} — proxy HTTP ${proxyStatus}`,
  };
}

async function checkEmailRedirect() {
  const domainId = await resolvePlatformStalwartDomainId();
  if (!domainId) {
    return { status: "warn" as const, detail: "Domaine plateforme absent dans Stalwart" };
  }

  const platformDomain = getPlatformEmailDomains()[0];
  const localPart = `health-redirect-${Date.now()}`;
  const source = `${localPart}@${platformDomain}`;
  const destination = process.env.BUREAU_ADMIN_EMAIL ?? "health-check@example.com";

  const res = await createAlias(source, destination, domainId);
  if (isStalwartFailure(res)) {
    return { status: "fail" as const, detail: "x:MailingList/set échoué" };
  }

  const listId = extractStalwartCreatedId(res);
  if (!listId) {
    return { status: "fail" as const, detail: "MailingList créée sans ID" };
  }

  const destroyRes = await deleteAlias(listId);
  if (isStalwartFailure(destroyRes)) {
    return { status: "warn" as const, detail: `MailingList ${listId} — cleanup échoué` };
  }

  return { status: "ok" as const, detail: "MailingList create + destroy OK" };
}

async function checkMailServer() {
  const stalwartStatus = await getStalwartStatus();
  if (stalwartStatus === "unconfigured") {
    return { status: "warn" as const, detail: "Stalwart non configuré" };
  }
  if (stalwartStatus === "unreachable") {
    return { status: "fail" as const, detail: "Stalwart JMAP injoignable" };
  }

  const mailHost =
    parseHostFromUrl(process.env.STALWART_URL ?? "") ??
    parseHostFromUrl(process.env.WEBMAIL_URL ?? "") ??
    `mail.${getPlatformEmailDomains()[0]}`;

  const smtp25 = await checkTcpPort(mailHost, 25);
  if (smtp25) {
    return { status: "ok" as const, detail: `Stalwart OK — SMTP :25 accessible (${mailHost})` };
  }

  const relayHost = process.env.OUTBOUND_SMTP_RELAY_HOST;
  const relayPort = Number(process.env.OUTBOUND_SMTP_RELAY_PORT ?? "2587");
  if (relayHost) {
    const relayOk = await checkTcpPort(relayHost, relayPort);
    if (relayOk) {
      return {
        status: "warn" as const,
        detail: `Stalwart OK — :25 fermé, relais ${relayHost}:${relayPort} OK`,
      };
    }
  }

  return {
    status: "warn" as const,
    detail: `Stalwart OK — SMTP :25 fermé${relayHost ? `, relais ${relayHost} injoignable` : ""}`,
  };
}

async function checkInfraPostgresql() {
  const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  if (result[0]?.ok !== 1) {
    return { status: "fail" as const, detail: "Requête SELECT 1 inattendue" };
  }
  return { status: "ok" as const, detail: "PostgreSQL répond" };
}

async function checkInfraStalwartJmap() {
  const status = await getStalwartStatus();
  if (status === "ok") return { status: "ok" as const, detail: "JMAP ping OK" };
  if (status === "unconfigured") {
    return { status: "warn" as const, detail: "STALWART_API_KEY / WEBMAIL_URL manquant" };
  }
  return { status: "fail" as const, detail: "JMAP injoignable" };
}

async function checkInfraK8sHealth() {
  const base = resolveAppBaseUrl();
  try {
    const res = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { status: "fail" as const, detail: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { status?: string; service?: string };
    if (body.status === "ok") {
      return { status: "ok" as const, detail: body.service ?? "framm-web" };
    }
    return { status: "warn" as const, detail: JSON.stringify(body) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "fail" as const, detail };
  }
}

async function checkInfraMailExternal() {
  const webmailBase = getWebmailExternalUrl();
  if (!webmailBase) {
    return { status: "warn" as const, detail: "WEBMAIL_URL non configuré" };
  }

  try {
    const res = await fetch(webmailBase, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status >= 500) {
      return { status: "fail" as const, detail: `HTTP ${res.status}` };
    }
    return { status: "ok" as const, detail: `HTTP ${res.status}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "fail" as const, detail };
  }
}

async function checkInfraTemRelay() {
  const host = process.env.OUTBOUND_SMTP_RELAY_HOST;
  const port = Number(process.env.OUTBOUND_SMTP_RELAY_PORT ?? "2587");

  if (!host) {
    return { status: "warn" as const, detail: "OUTBOUND_SMTP_RELAY non configuré" };
  }

  const ok = await checkTcpPort(host, port);
  if (ok) {
    return { status: "ok" as const, detail: `${host}:${port} accessible` };
  }
  return { status: "fail" as const, detail: `${host}:${port} injoignable` };
}

async function checkInfraS3() {
  const bucket = process.env.S3_BUCKET_UPLOADS;
  if (!bucket || !process.env.S3_ACCESS_KEY) {
    return { status: "warn" as const, detail: "S3 non configuré" };
  }

  const client = new S3Client({
    region: process.env.S3_REGION ?? "fr-par",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { status: "ok" as const, detail: `Bucket ${bucket} accessible` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { status: "fail" as const, detail };
  }
}

export const HEALTH_CHECK_DEFINITIONS: HealthCheckDefinition[] = [
  { id: "connection", run: checkConnection },
  { id: "org-create", run: checkOrgCreate },
  { id: "org-approval", run: checkOrgApproval },
  { id: "mailbox-create", run: checkMailboxCreate },
  { id: "webmail-access", run: checkWebmailAccess },
  { id: "email-redirect", run: checkEmailRedirect },
  { id: "mail-server", run: checkMailServer },
  { id: "infra-postgresql", run: checkInfraPostgresql },
  { id: "infra-stalwart-jmap", run: checkInfraStalwartJmap },
  { id: "infra-k8s-health", run: checkInfraK8sHealth },
  { id: "infra-mail-external", run: checkInfraMailExternal },
  { id: "infra-tem-relay", run: checkInfraTemRelay },
  { id: "infra-s3", run: checkInfraS3 },
];

export async function runHealthCheck(
  definition: HealthCheckDefinition,
  ctx: HealthCheckContext
): Promise<HealthCheckResult> {
  const { value, durationMs } = await timed(async () => {
    try {
      return await definition.run(ctx);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { status: "fail" as const, detail };
    }
  });

  return { id: definition.id, ...value, durationMs };
}

export async function runAllHealthChecks(ctx: HealthCheckContext): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  for (const definition of HEALTH_CHECK_DEFINITIONS) {
    results.push(await runHealthCheck(definition, ctx));
  }
  return results;
}

export function findHealthCheckDefinition(id: string): HealthCheckDefinition | undefined {
  return HEALTH_CHECK_DEFINITIONS.find((def) => def.id === id);
}
