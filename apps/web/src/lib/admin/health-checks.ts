import { connect } from "node:net";
import nodemailer from "nodemailer";
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
import { obtainStalwartSession } from "@/lib/stalwart/webmail-auth";
import { fetchJmapSession } from "@/lib/mail/jmap-proxy";

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

async function checkWebmailSsoLogin() {
  const webmailBase = getWebmailExternalUrl();
  if (!webmailBase) {
    return { status: "warn" as const, detail: "WEBMAIL_URL non configuré" };
  }

  const domainId = await resolvePlatformStalwartDomainId();
  if (!domainId) {
    return { status: "warn" as const, detail: "Domaine plateforme absent dans Stalwart" };
  }

  const platformDomain = getPlatformEmailDomains()[0];
  if (!platformDomain) {
    return { status: "warn" as const, detail: "Aucun domaine plateforme configuré" };
  }

  const localPart = `health-sso-${Date.now()}`;

  const createRes = await createAccount(localPart, domainId, TEST_PASSWORD, localPart);
  if (isStalwartFailure(createRes)) {
    return { status: "fail" as const, detail: "x:Account/set échoué" };
  }

  const accountId = extractStalwartCreatedId(createRes);
  if (!accountId) {
    return { status: "fail" as const, detail: "Compte SSO créé sans ID retourné" };
  }

  const accountGetRes = await stalwartAdminJmap([
    ["x:Account/get", { ids: [accountId], properties: ["emailAddress"] }, "g1"],
  ]);
  if ("unavailable" in accountGetRes || "error" in accountGetRes) {
    await deleteAccountSafe(accountId);
    return {
      status: "fail" as const,
      detail: "Impossible de lire emailAddress du compte SSO",
    };
  }

  const accountList = extractAccountEmailList(accountGetRes);
  const address = accountList[0]?.emailAddress;
  if (!address) {
    await deleteAccountSafe(accountId);
    return { status: "fail" as const, detail: "Compte SSO sans emailAddress" };
  }

  try {
    const tokens = await obtainStalwartSession(address, TEST_PASSWORD);
    if (!tokens.accessToken) {
      return { status: "fail" as const, detail: "OAuth SSO sans access_token" };
    }

    const session = await fetchJmapSession(tokens);
    const accountCount = Object.keys(session.accounts ?? {}).length;
    if (accountCount === 0) {
      return {
        status: "fail" as const,
        detail: "Session JMAP vide après OAuth (aucun compte mail)",
      };
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const cleanupErr = await deleteAccountSafe(accountId);
    const suffix = cleanupErr ? ` — ${cleanupErr}` : "";
    return { status: "fail" as const, detail: `OAuth SSO: ${detail}${suffix}` };
  }

  const destroyRes = await deleteAccount(accountId);
  if (isStalwartFailure(destroyRes)) {
    return {
      status: "warn" as const,
      detail: `OAuth SSO OK — cleanup JMAP échoué (${accountId})`,
    };
  }

  return { status: "ok" as const, detail: "OAuth SSO + session JMAP OK" };
}

function extractAccountEmailList(res: unknown): { emailAddress?: string }[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1];
  if (!body || typeof body !== "object" || !("list" in body)) return [];
  const list = (body as { list: unknown }).list;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is { emailAddress?: string } => typeof item === "object" && item !== null
  );
}

async function deleteAccountSafe(accountId: string): Promise<string | null> {
  const destroyRes = await deleteAccount(accountId);
  if (isStalwartFailure(destroyRes)) {
    return `Compte ${accountId} — cleanup échoué`;
  }
  return null;
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
    const proxyRes = await fetch(`${appBase}/api/mail/health-check-probe/jmap`, {
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
      detail: `Webmail HTTP ${webmailHttp} — API JMAP intégrée active (${proxyStatus})`,
    };
  }

  if (proxyStatus >= 500) {
    return { status: "fail" as const, detail: `Proxy SSO HTTP ${proxyStatus}` };
  }

  return {
    status: "ok" as const,
    detail: `Webmail HTTP ${webmailHttp} — API JMAP HTTP ${proxyStatus}`,
  };
}

type JmapMethodCall = [string, Record<string, unknown>, string];

type SmtpRelayConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

type QueuedRecipientStatus =
  | "Scheduled"
  | "Completed"
  | "TemporaryFailure"
  | "PermanentFailure"
  | string;

async function stalwartAdminJmap(methodCalls: JmapMethodCall[], timeoutMs = 15_000) {
  const base = (process.env.WEBMAIL_URL || process.env.STALWART_URL || "").replace(/\/$/, "");
  const apiKey = process.env.STALWART_API_KEY ?? "";
  if (!base || !apiKey) {
    return { unavailable: true as const };
  }

  try {
    const res = await fetch(`${base}/jmap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
        methodCalls,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { error: `JMAP HTTP ${res.status}` as const };
    }

    return res.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { error: detail };
  }
}

function resolveSmtpRelayConfig(): SmtpRelayConfig | null {
  const host = process.env.OUTBOUND_SMTP_RELAY_HOST;
  const user = process.env.OUTBOUND_SMTP_RELAY_USER;
  const pass = process.env.OUTBOUND_SMTP_RELAY_SECRET;
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.OUTBOUND_SMTP_RELAY_PORT ?? "2587"),
    user,
    pass,
  };
}

async function sendHealthCheckEmail(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true; via: string } | { ok: false; detail: string }> {
  const relay = resolveSmtpRelayConfig();
  if (!relay) {
    return {
      ok: false,
      detail: "Relais TEM non configuré (OUTBOUND_SMTP_RELAY_*) — envoi via Stalwart :25/:587 indisponible sur Scaleway",
    };
  }

  const label = `TEM ${relay.host}:${relay.port}`;
  const transport = nodemailer.createTransport({
    host: relay.host,
    port: relay.port,
    secure: false,
    auth: { user: relay.user, pass: relay.pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });

  try {
    await transport.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
    transport.close();
    return { ok: true, via: label };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    transport.close();
    return { ok: false, detail: `${label}: ${detail}` };
  }
}

function extractQueuedMessageList(res: unknown): {
  id: string;
  recipients?: Record<string, { status?: QueuedRecipientStatus }>;
}[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1];
  if (!body || typeof body !== "object" || !("list" in body)) return [];
  const list = (body as { list: unknown }).list;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is { id: string; recipients?: Record<string, { status?: QueuedRecipientStatus }> } =>
      typeof item === "object" && item !== null && "id" in item
  );
}

function recipientDeliveryStatus(
  recipients: Record<string, { status?: QueuedRecipientStatus }> | undefined,
  destination: string
): QueuedRecipientStatus | null {
  if (!recipients) return null;

  const normalized = destination.toLowerCase();
  for (const [address, meta] of Object.entries(recipients)) {
    if (address.toLowerCase() === normalized || address.toLowerCase().includes(normalized)) {
      return meta.status ?? null;
    }
  }

  return Object.values(recipients)[0]?.status ?? null;
}

async function waitForQueuedDelivery(
  destination: string,
  subjectToken: string,
  timeoutMs = 30_000
): Promise<
  | { outcome: "completed"; detail: string }
  | { outcome: "failed"; detail: string }
  | { outcome: "timeout"; detail: string }
  | { outcome: "unavailable"; detail: string }
> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const queryRes = await stalwartAdminJmap([
      ["x:QueuedMessage/query", { filter: { to: destination } }, "q1"],
    ]);

    if ("unavailable" in queryRes || "error" in queryRes) {
      return {
        outcome: "unavailable",
        detail:
          "error" in queryRes
            ? String(queryRes.error)
            : "JMAP indisponible pour x:QueuedMessage/query",
      };
    }

    const ids = extractJmapQueryIds(queryRes);
    if (ids.length > 0) {
      const getRes = await stalwartAdminJmap([
        ["x:QueuedMessage/get", { ids, properties: ["recipients", "returnPath"] }, "g1"],
      ]);

      if (!("unavailable" in getRes) && !("error" in getRes)) {
        for (const message of extractQueuedMessageList(getRes)) {
          const status = recipientDeliveryStatus(message.recipients, destination);
          if (status === "Completed") {
            return { outcome: "completed", detail: `Queue Completed → ${destination}` };
          }
          if (status === "PermanentFailure") {
            return {
              outcome: "failed",
              detail: `Queue PermanentFailure → ${destination}`,
            };
          }
        }
      }
    }

    const textQueryRes = await stalwartAdminJmap([
      ["x:QueuedMessage/query", { filter: { text: subjectToken } }, "q2"],
    ]);

    if (!("unavailable" in textQueryRes) && !("error" in textQueryRes)) {
      const textIds = extractJmapQueryIds(textQueryRes);
      if (textIds.length > 0) {
        const getRes = await stalwartAdminJmap([
          ["x:QueuedMessage/get", { ids: textIds, properties: ["recipients"] }, "g2"],
        ]);

        if (!("unavailable" in getRes) && !("error" in getRes)) {
          for (const message of extractQueuedMessageList(getRes)) {
            const status = recipientDeliveryStatus(message.recipients, destination);
            if (status === "Completed") {
              return { outcome: "completed", detail: `Queue Completed (sujet) → ${destination}` };
            }
            if (status === "PermanentFailure") {
              return {
                outcome: "failed",
                detail: `Queue PermanentFailure (sujet) → ${destination}`,
              };
            }
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  return {
    outcome: "timeout",
    detail: `Timeout ${timeoutMs / 1000}s — livraison non confirmée vers ${destination}`,
  };
}

function extractJmapQueryIds(res: unknown): string[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1];
  if (!body || typeof body !== "object" || !("ids" in body)) return [];
  const ids = (body as { ids: unknown }).ids;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

async function deleteMailingListSafe(listId: string): Promise<string | null> {
  const destroyRes = await deleteAlias(listId);
  if (isStalwartFailure(destroyRes)) {
    return `MailingList ${listId} — cleanup échoué`;
  }
  return null;
}

async function checkEmailRedirect() {
  const domainId = await resolvePlatformStalwartDomainId();
  if (!domainId) {
    return { status: "fail" as const, detail: "Domaine plateforme absent dans Stalwart" };
  }

  const destination = process.env.BUREAU_ADMIN_EMAIL;
  if (!destination) {
    return {
      status: "fail" as const,
      detail: "BUREAU_ADMIN_EMAIL requis pour tester la redirection SMTP",
    };
  }

  const platformDomain = getPlatformEmailDomains()[0];
  const localPart = `health-redirect-${Date.now()}`;
  const source = `${localPart}@${platformDomain}`;
  const subject = `Framm health redirect ${Date.now()}`;

  const res = await createAlias(source, destination, domainId);
  if (isStalwartFailure(res)) {
    return { status: "fail" as const, detail: "x:MailingList/set échoué" };
  }

  const listId = extractStalwartCreatedId(res);
  if (!listId) {
    return { status: "fail" as const, detail: "MailingList créée sans ID" };
  }

  const sendResult = await sendHealthCheckEmail({
    from: `health-check@${platformDomain}`,
    to: source,
    subject,
    text: `Test redirection Framm → ${destination}`,
  });

  if (!sendResult.ok) {
    const cleanupErr = await deleteMailingListSafe(listId);
    const detail = cleanupErr
      ? `Envoi SMTP impossible : ${sendResult.detail} — ${cleanupErr}`
      : `Envoi SMTP impossible : ${sendResult.detail}`;
    return { status: "fail" as const, detail };
  }

  const delivery = await waitForQueuedDelivery(destination, subject);
  const cleanupErr = await deleteMailingListSafe(listId);

  if (delivery.outcome === "completed") {
    if (cleanupErr) {
      return { status: "fail" as const, detail: `${delivery.detail} — ${cleanupErr}` };
    }
    return {
      status: "ok" as const,
      detail: `MailingList + SMTP (${sendResult.via}) + ${delivery.detail}`,
    };
  }

  const deliveryDetail =
    delivery.outcome === "unavailable"
      ? `vérification queue impossible : ${delivery.detail}`
      : delivery.detail;

  const detail = cleanupErr
    ? `SMTP OK (${sendResult.via}) — ${deliveryDetail} — ${cleanupErr}`
    : `SMTP OK (${sendResult.via}) — ${deliveryDetail}`;

  return { status: "fail" as const, detail };
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
        status: "ok" as const,
        detail: `Stalwart OK — SMTP :25 fermé (normal Scaleway), relais TEM ${relayHost}:${relayPort} OK`,
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
  { id: "webmail-sso-login", run: checkWebmailSsoLogin },
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
